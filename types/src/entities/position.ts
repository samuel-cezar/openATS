import type { ObjectId } from './common';
import type { EmbeddingVector } from '../scoring/embeddings';

export interface Position {
  _id: ObjectId;
  tenantId: ObjectId;
  selectionProcessId?: ObjectId;
  title?: string;
  jobDescription?: string;
  hardSkillsRequired: string[];
  softSkillsRequired: string[];
  embeddingHS: EmbeddingVector;
  embeddingSS: EmbeddingVector;
  processed: boolean;
  /** True when jobDescription changed after processing and skills/embeddings need to be regenerated. */
  skillsStale: boolean;
}
