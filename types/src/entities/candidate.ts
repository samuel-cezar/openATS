import type { ObjectId } from './common';
import type { EmbeddingVector } from '../scoring/embeddings';

export interface Candidate {
  _id: ObjectId;
  tenantId: ObjectId;
  name?: string;
  email?: string;
  /** Path/URL to the uploaded resume file (PDF), set via POST /candidates/:id/upload. This is the input to skill extraction. */
  resumePdfUrl?: string;
  /** Original filename of the uploaded resume file, for display purposes. */
  resumeFileName?: string;
  extractedText?: string;
  hardSkills: string[];
  softSkills: string[];
  embeddingHS: EmbeddingVector;
  embeddingSS: EmbeddingVector;
  processed: boolean;
  /** True when the resume changed after processing and skills/embeddings need to be regenerated. */
  skillsStale: boolean;
}
