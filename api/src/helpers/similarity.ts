import Candidate from '../models/Candidate.js';
import Position from '../models/Position.js';
import type { TenantDocument } from '../models/Tenant.js';

export function cosineSimilarity(vecA?: number[], vecB?: number[]): number {
  if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) return 0;
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.hypot(...vecA);
  const magB = Math.hypot(...vecB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export async function computeMatch(
  candidateId: unknown,
  positionId: string,
  tenant: TenantDocument
): Promise<{ total: number; hard: number; soft: number }> {
  const [cand, pos] = await Promise.all([
    Candidate.findById(candidateId),
    Position.findById(positionId),
  ]);
  const simHS = cosineSimilarity(cand!.embeddingHS, pos!.embeddingHS);
  const simSS = cosineSimilarity(cand!.embeddingSS, pos!.embeddingSS);
  const total = tenant.alpha * simHS + tenant.beta * simSS;
  return { total, hard: simHS, soft: simSS };
}
