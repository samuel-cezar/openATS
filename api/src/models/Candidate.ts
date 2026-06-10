import mongoose, { Schema, type Document } from 'mongoose';
import type { Candidate } from '@openats/types';

/**
 * Mongoose document for Candidate. Reuses the shared `Candidate` shape from
 * @openats/types; only `_id` (ObjectId vs wire-string) differs between
 * the in-memory and JSON-wire forms.
 */
export interface CandidateDocument extends Document, Omit<Candidate, '_id'> {}

const candidateSchema = new Schema<CandidateDocument>({
  tenantId: { type: String, required: true, index: true },
  name: String,
  email: String,
  resumePdfUrl: String,
  resumeFileName: String,
  extractedText: String,
  hardSkills: [String],
  softSkills: [String],
  embeddingHS: [Number],
  embeddingSS: [Number],
  processed: { type: Boolean, default: false },
  skillsStale: { type: Boolean, default: false },
});

export default mongoose.model<CandidateDocument>('Candidate', candidateSchema);
