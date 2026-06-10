import { Match } from '../entities/match';

// POST /api/v1/matches/position/:positionId
export interface ComputeMatchesResponse {
  computed: number;
  matches: Match[];
}
