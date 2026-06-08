const express = require('express');
const router = express.Router();
const SelectionProcess = require('../models/SelectionProcess');

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

module.exports = router;
