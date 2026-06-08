const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');

// POST /tenants — create tenant (no X-Tenant-Id required)
router.post('/', async (req, res) => {
  try {
    const tenant = await Tenant.create(req.body);
    res.status(201).json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /tenants/:id
router.get('/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /tenants/:id/weights — update alpha and beta
router.put('/:id/weights', async (req, res) => {
  try {
    const { alpha, beta } = req.body;
    if (alpha + beta !== 1) return res.status(400).json({ error: 'alpha + beta must equal 1' });
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { alpha, beta },
      { new: true, runValidators: true }
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
