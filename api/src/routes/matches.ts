import express, { type Request, type Response } from 'express';
import Candidate from '../models/Candidate.js';
import Position from '../models/Position.js';
import Match, { type MatchDocument } from '../models/Match.js';
import { computeMatch, resolveTenantWeights } from '../helpers/similarity.js';

const router = express.Router();

// POST /matches/position/:positionId — compute/update matches for all candidates
router.post('/position/:positionId', async (req: Request<{ positionId: string }>, res: Response) => {
  try {
    const position = await Position.findOne({ _id: req.params.positionId, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });

    // Tenant ids are arbitrary header strings (e.g. "demo"), not necessarily
    // Tenant document ids — resolveTenantWeights looks up by key then ObjectId
    // and falls back to the default weights, mirroring services/5_matching.
    const weights = await resolveTenantWeights(req.tenantId);

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
