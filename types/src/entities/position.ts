import type { ObjectId } from './common';
import type { EmbeddingVector } from '../scoring/embeddings';

export interface Position {
  _id: ObjectId;
  tenantId: ObjectId;
  selectionProcessId?: ObjectId;
  title?: string;
  /** Optional free-text description for human reference only — not used by skill extraction. */
  jobDescription?: string;
  /** Path/URL to the uploaded job description file (PDF or DOCX), set via POST /positions/:id/upload. This is the input to skill extraction. */
  jobDescriptionFileUrl?: string;
  /** Original filename of the uploaded job description file, for display purposes. */
  jobDescriptionFileName?: string;
  hardSkillsRequired: string[];
  softSkillsRequired: string[];
  embeddingHS: EmbeddingVector;
  embeddingSS: EmbeddingVector;
  processed: boolean;
  /** True when the job description file changed after processing and skills/embeddings need to be regenerated. */
  skillsStale: boolean;
}
