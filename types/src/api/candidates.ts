import type { Candidate } from '../entities/candidate';
import type { Position } from '../entities/position';
import type { Match } from '../entities/match';
import type { DeletedResponse } from './common';

// POST /api/v1/candidates
export interface CreateCandidateRequest {
  name?: string;
  email?: string;
}
export type CreateCandidateResponse = Candidate;

// GET /api/v1/candidates
export type ListCandidatesResponse = Candidate[];

// GET /api/v1/candidates/:id
export type GetCandidateResponse = Candidate;

// PUT /api/v1/candidates/:id
export interface UpdateCandidateRequest {
  name?: string;
  email?: string;
}
export type UpdateCandidateResponse = Candidate;

// DELETE /api/v1/candidates/:id
export type DeleteCandidateResponse = DeletedResponse;

// POST /api/v1/candidates/:id/upload (multipart/form-data, field name "resume")
export interface UploadCandidateResumeResponse {
  message: string;
  resumePdfUrl: string;
  candidate: Candidate;
}

// POST /api/v1/candidates/:id/process
export interface ProcessCandidateResponse {
  message: string;
  candidate: Candidate;
}

// GET /api/v1/candidates/:candidateId/matches
export interface CandidateMatchEntry extends Omit<Match, 'positionId'> {
  positionId: Pick<Position, '_id' | 'title'>;
}
export type GetCandidateMatchesResponse = CandidateMatchEntry[];
