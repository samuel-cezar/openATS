import mongoose, { Schema, type Document } from 'mongoose';
import type { Position } from '@openats/types';

/**
 * Mongoose document for Position. Reuses the shared `Position` shape from
 * @openats/types; only `_id` (ObjectId vs wire-string) differs between
 * the in-memory and JSON-wire forms.
 */
export interface PositionDocument extends Document, Omit<Position, '_id'> {}

const positionSchema = new Schema<PositionDocument>({
  tenantId: { type: String, required: true, index: true },
  selectionProcessId: { type: Schema.Types.ObjectId, ref: 'SelectionProcess' },
  title: String,
  jobDescription: String,
  hardSkillsRequired: [String],
  softSkillsRequired: [String],
  embeddingHS: [Number],
  embeddingSS: [Number],
  processed: { type: Boolean, default: false },
  skillsStale: { type: Boolean, default: false },
});

export default mongoose.model<PositionDocument>('Position', positionSchema);
