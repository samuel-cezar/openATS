const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');
const Candidate = require('../models/Candidate');
const Match = require('../models/Match');
const { computeMatch } = require('../helpers/similarity');

// POST /matches/position/:positionId — compute/update matches for all candidates
router.post('/position/:positionId', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const candidates = await Candidate.find({
      tenantId: req.tenantId,
      processed: true
    });

    const results = [];
    for (const cand of candidates) {
      const scores = await computeMatch(cand._id, req.params.positionId, tenant);
      const match = await Match.findOneAndUpdate(
        { tenantId: req.tenantId, candidateId: cand._id, positionId: req.params.positionId },
        {
          tenantId: req.tenantId,
          candidateId: cand._id,
          positionId: req.params.positionId,
          totalScore: scores.total,
          hardScore: scores.hard,
          softScore: scores.soft,
          computedAt: new Date()
        },
        { upsert: true, new: true }
      );
      results.push(match);
    }

    // assign ranks after all scores are computed
    const sorted = await Match.find({
      positionId: req.params.positionId,
      tenantId: req.tenantId
    }).sort({ totalScore: -1 });

    for (let i = 0; i < sorted.length; i++) {
      sorted[i].rank = i + 1;
      await sorted[i].save();
    }

    res.json({ computed: results.length, matches: sorted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
