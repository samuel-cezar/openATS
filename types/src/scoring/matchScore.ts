/**
 * Per-tenant weighting applied to hard-skill vs soft-skill similarity
 * when computing a Match's totalScore. alpha + beta must equal 1.
 */
export interface TenantWeights {
  alpha: number;
  beta: number;
}

/**
 * Result of `computeMatch()` — cosine similarities for each skill
 * category plus the weighted total stored as `Match.totalScore`.
 */
export interface MatchScores {
  total: number;
  hard: number;
  soft: number;
}
