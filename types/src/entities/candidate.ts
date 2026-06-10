import type { ObjectId } from './common';
import type { EmbeddingVector } from '../scoring/embeddings';

export interface Candidate {
  _id: ObjectId;
  tenantId: ObjectId;
  name?: string;
  email?: string;
  resumePdfUrl?: string;
  extractedText?: string;
  hardSkills: string[];
  softSkills: string[];
  embeddingHS: EmbeddingVector;
  embeddingSS: EmbeddingVector;
  processed: boolean;
  /** True when the resume changed after processing and skills/embeddings need to be regenerated. */
  skillsStale: boolean;
}
