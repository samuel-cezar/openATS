const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /users
router.post('/', async (req, res) => {
  try {
    const user = await User.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /users
router.get('/', async (req, res) => {
  try {
    const users = await User.find({ tenantId: req.tenantId });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
