const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Candidate = require('../models/Candidate');
const Match = require('../models/Match');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files allowed'));
  cb(null, true);
}});

// POST /candidates
router.post('/', async (req, res) => {
  try {
    const candidate = await Candidate.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json(candidate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /candidates/:id/upload — multipart PDF upload
router.post('/:id/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const candidate = await Candidate.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { resumePdfUrl: req.file.path },
      { new: true }
    );
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json({ message: 'Resume uploaded', resumePdfUrl: req.file.path, candidate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /candidates/:id/process — stub for OCR → RAG → embeddings
router.post('/:id/process', async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    if (!candidate.resumePdfUrl) return res.status(400).json({ error: 'No resume uploaded yet' });

    // TODO: run OCR on resumePdfUrl → extractedText
    // TODO: run RAG skill extraction → hardSkills, softSkills
    // TODO: generate embeddings → embeddingHS, embeddingSS
    candidate.processed = true;
    candidate.skillsStale = false;
    await candidate.save();

    res.json({ message: 'Processing triggered (stub)', candidate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /candidates
router.get('/', async (req, res) => {
  try {
    const candidates = await Candidate.find({ tenantId: req.tenantId });
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /candidates/:id
router.get('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json(candidate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /candidates/:id — name/email only; does not affect resume-derived skills
router.put('/:id', async (req, res) => {
  try {
    const { name, email } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    const candidate = await Candidate.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      updates,
      { new: true, runValidators: true }
    );
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json(candidate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /candidates/:id — also clears its match results
router.delete('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    await Match.deleteMany({ candidateId: req.params.id, tenantId: req.tenantId });
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /candidates/:candidateId/matches
router.get('/:candidateId/matches', async (req, res) => {
  try {
    const matches = await Match.find({
      candidateId: req.params.candidateId,
      tenantId: req.tenantId
    })
      .sort({ totalScore: -1 })
      .populate('positionId', 'title');
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
