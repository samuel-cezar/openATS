const express = require('express');
const router = express.Router();
const SelectionProcess = require('../models/SelectionProcess');
const Position = require('../models/Position');

// POST /selection-processes
router.post('/', async (req, res) => {
  try {
    const process = await SelectionProcess.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json(process);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /selection-processes
router.get('/', async (req, res) => {
  try {
    const processes = await SelectionProcess.find({ tenantId: req.tenantId });
    res.json(processes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /selection-processes/:id
router.get('/:id', async (req, res) => {
  try {
    const process = await SelectionProcess.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!process) return res.status(404).json({ error: 'Selection process not found' });
    res.json(process);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /selection-processes/:id
router.put('/:id', async (req, res) => {
  try {
    const { tenantId, ...updates } = req.body;
    const process = await SelectionProcess.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      updates,
      { new: true, runValidators: true }
    );
    if (!process) return res.status(404).json({ error: 'Selection process not found' });
    res.json(process);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /selection-processes/:id
router.delete('/:id', async (req, res) => {
  try {
    const positionCount = await Position.countDocuments({
      selectionProcessId: req.params.id,
      tenantId: req.tenantId
    });
    if (positionCount > 0) {
      return res.status(400).json({ error: 'Remove its positions first' });
    }
    const process = await SelectionProcess.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!process) return res.status(404).json({ error: 'Selection process not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
