import { ObjectId } from '../entities/common';
import { Position } from '../entities/position';
import { Candidate } from '../entities/candidate';
import { Match } from '../entities/match';
import { DeletedResponse } from './common';

// POST /api/v1/positions
export interface CreatePositionRequest {
  title?: string;
  jobDescription?: string;
  selectionProcessId?: ObjectId;
  hardSkillsRequired?: string[];
  softSkillsRequired?: string[];
}
export type CreatePositionResponse = Position;

// GET /api/v1/positions
export type ListPositionsResponse = Position[];

// GET /api/v1/positions/:id
export type GetPositionResponse = Position;

// PUT /api/v1/positions/:id
export interface UpdatePositionRequest {
  title?: string;
  jobDescription?: string;
  selectionProcessId?: ObjectId;
}
export type UpdatePositionResponse = Position;

// DELETE /api/v1/positions/:id
export type DeletePositionResponse = DeletedResponse;

// POST /api/v1/positions/:id/process
export interface ProcessPositionResponse {
  message: string;
  position: Position;
}

// GET /api/v1/positions/:positionId/ranking
export interface PositionRankingEntry extends Omit<Match, 'candidateId'> {
  candidateId: Pick<Candidate, '_id' | 'name' | 'email'>;
}
export type GetPositionRankingResponse = PositionRankingEntry[];
