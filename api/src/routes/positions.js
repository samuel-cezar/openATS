const express = require('express');
const router = express.Router();
const Position = require('../models/Position');
const Match = require('../models/Match');

// POST /positions
router.post('/', async (req, res) => {
  try {
    const position = await Position.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json(position);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /positions
router.get('/', async (req, res) => {
  try {
    const positions = await Position.find({ tenantId: req.tenantId });
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /positions/:id
router.get('/:id', async (req, res) => {
  try {
    const position = await Position.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });
    res.json(position);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /positions/:id
router.put('/:id', async (req, res) => {
  try {
    const position = await Position.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });

    const { title, jobDescription, selectionProcessId } = req.body;

    // A processed position whose job description changes has stale skills/embeddings.
    if (position.processed && jobDescription !== undefined && jobDescription !== position.jobDescription) {
      position.skillsStale = true;
    }

    if (title !== undefined) position.title = title;
    if (jobDescription !== undefined) position.jobDescription = jobDescription;
    if (selectionProcessId !== undefined) position.selectionProcessId = selectionProcessId;

    await position.save();
    res.json(position);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /positions/:id — also clears its rankings
router.delete('/:id', async (req, res) => {
  try {
    const position = await Position.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });
    await Match.deleteMany({ positionId: req.params.id, tenantId: req.tenantId });
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /positions/:id/process — stub for LLM extraction + embeddings
router.post('/:id/process', async (req, res) => {
  try {
    const position = await Position.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });

    // TODO: call LLM to extract skills from position.jobDescription
    // TODO: generate embeddings for hardSkillsRequired and softSkillsRequired
    // Stub: mark as processed with empty skills
    position.processed = true;
    position.skillsStale = false;
    await position.save();

    res.json({ message: 'Processing triggered (stub)', position });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /positions/:positionId/ranking
router.get('/:positionId/ranking', async (req, res) => {
  try {
    const matches = await Match.find({
      positionId: req.params.positionId,
      tenantId: req.tenantId
    })
      .sort({ totalScore: -1 })
      .populate('candidateId', 'name email');
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
