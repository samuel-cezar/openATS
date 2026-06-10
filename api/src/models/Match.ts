import mongoose, { Schema, type Document } from 'mongoose';
import type { Match } from '@openats/types';

/**
 * Mongoose document for Match. Reuses the shared `Match` shape from
 * @openats/types, but `_id`/`candidateId`/`positionId` (ObjectId vs
 * wire-string) and `computedAt` (Date vs ISODateString) differ between
 * the in-memory and JSON-wire forms.
 */
export interface MatchDocument
  extends Document,
    Omit<Match, '_id' | 'candidateId' | 'positionId' | 'computedAt'> {
  candidateId: mongoose.Types.ObjectId;
  positionId: mongoose.Types.ObjectId;
  computedAt: Date;
}

const matchSchema = new Schema<MatchDocument>({
  tenantId: { type: String, required: true, index: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate' },
  positionId: { type: Schema.Types.ObjectId, ref: 'Position' },
  totalScore: Number,
  hardScore: Number,
  softScore: Number,
  rank: Number,
  computedAt: { type: Date, default: Date.now },
});

export default mongoose.model<MatchDocument>('Match', matchSchema);
