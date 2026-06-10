/**
 * Dense vector representation of extracted skills, produced by the
 * embeddings pipeline (see `4_embeddings/`). Stored on both `Position`
 * and `Candidate` as `embeddingHS` (hard skills) and `embeddingSS` (soft skills).
 */
export type EmbeddingVector = number[];

/** The two skill categories that are embedded and matched independently. */
export type SkillCategory = 'hard' | 'soft';
