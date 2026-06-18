import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import Candidate from '../models/Candidate.js';
import Position from '../models/Position.js';
import Match, { type MatchDocument } from '../models/Match.js';
import { computeMatch, DEFAULT_WEIGHTS, type MatchWeights } from '../helpers/similarity.js';

const router = express.Router();

// POST /matches/position/:positionId — compute/update matches for all candidates
router.post('/position/:positionId', async (req: Request<{ positionId: string }>, res: Response) => {
  try {
    const position = await Position.findOne({ _id: req.params.positionId, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });

    // Tenant ids are arbitrary header strings (e.g. "demo"), not necessarily
    // Tenant document ids — fall back to the default weights when none
    // resolves, mirroring services/5_matching.
    const tenant = mongoose.isValidObjectId(req.tenantId)
      ? await Tenant.findById(req.tenantId)
      : null;
    const weights: MatchWeights = tenant ?? DEFAULT_WEIGHTS;

    const candidates = await Candidate.find({
      tenantId: req.tenantId,
      processed: true
    });

    const results: MatchDocument[] = [];
    for (const cand of candidates) {
      const scores = await computeMatch(cand._id, req.params.positionId, weights);
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
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
