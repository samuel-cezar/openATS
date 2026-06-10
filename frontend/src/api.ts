import type {
  Candidate,
  ComputeMatchesResponse,
  CreateCandidateRequest,
  CreatePositionRequest,
  CreateSelectionProcessRequest,
  DeletedResponse,
  ISODateString,
  ObjectId,
  Position,
  ProcessCandidateResponse,
  ProcessPositionResponse,
  SelectionProcess,
  UpdateCandidateRequest,
  UpdatePositionRequest,
  UploadCandidateResumeResponse,
} from '@openats/types';

// Some API responses expose `id` alongside Mongo's `_id`; UI code reads both.
export type WithId<T> = T & { id?: ObjectId };
export type ProcessRecord = WithId<SelectionProcess>;
export type PositionRecord = WithId<Position>;
export type CandidateRecord = WithId<Candidate>;

// The processes form clears dates by sending explicit nulls.
export type ProcessPayload = Omit<CreateSelectionProcessRequest, 'startDate' | 'endDate'> & {
  startDate?: ISODateString | null;
  endDate?: ISODateString | null;
};

// RankingPage tolerates several legacy field aliases for scores and candidate info.
export interface RankingEntry {
  candidateId?: ObjectId | Pick<Candidate, '_id' | 'name' | 'email'>;
  id?: ObjectId;
  rank?: number;
  totalScore?: number;
  score?: number;
  total?: number;
  hardScore?: number;
  hardSkillScore?: number;
  hard?: number;
  softScore?: number;
  softSkillScore?: number;
  soft?: number;
  candidateName?: string;
  name?: string;
  email?: string;
  candidate?: { name?: string; email?: string };
}
export type RankingResponse =
  | RankingEntry[]
  | { ranking?: RankingEntry[]; data?: RankingEntry[]; results?: RankingEntry[] };

const ATS_BASE = 'http://localhost:3000/api/v1';
const ATS_HEADERS = {
  'Content-Type': 'application/json',
  'X-Tenant-Id': 'demo',
};

async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ATS_BASE}${path}`, {
    method,
    headers: ATS_HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = JSON.parse(text); msg = j.message || j.error || j.detail || msg; } catch {}
    throw new Error(msg);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

const idCache = {
  get(key: string): string[] {
    try { return JSON.parse(localStorage.getItem('ats_ids_' + key) ?? 'null') || []; }
    catch { return []; }
  },
  add(key: string, id: ObjectId) {
    const ids = this.get(key);
    if (!ids.includes(String(id))) {
      ids.unshift(String(id));
      localStorage.setItem('ats_ids_' + key, JSON.stringify(ids));
    }
  },
  remove(key: string, id: ObjectId) {
    const ids = this.get(key).filter(x => x !== String(id));
    localStorage.setItem('ats_ids_' + key, JSON.stringify(ids));
  },
};

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const obj = data as { data?: unknown; items?: unknown; results?: unknown } | null;
  if (obj && Array.isArray(obj.data)) return obj.data as T[];
  if (obj && Array.isArray(obj.items)) return obj.items as T[];
  if (obj && Array.isArray(obj.results)) return obj.results as T[];
  return [];
}

export const api = {
  // ── Selection Processes ──────────────────────────────
  getProcesses: () =>
    apiFetch<unknown>('GET', '/selection-processes').then(d => normalizeList<ProcessRecord>(d)),
  getProcess: (id: ObjectId) => apiFetch<ProcessRecord>('GET', `/selection-processes/${id}`),
  createProcess: (data: ProcessPayload) => apiFetch<ProcessRecord>('POST', '/selection-processes', data),
  updateProcess: (id: ObjectId, data: ProcessPayload) =>
    apiFetch<ProcessRecord>('PUT', `/selection-processes/${id}`, data),
  deleteProcess: (id: ObjectId) => apiFetch<DeletedResponse>('DELETE', `/selection-processes/${id}`),

  // ── Positions ────────────────────────────────────────
  getPositions: async (): Promise<PositionRecord[]> => {
    try {
      return normalizeList<PositionRecord>(await apiFetch<unknown>('GET', '/positions'));
    } catch {
      const ids = idCache.get('positions');
      const settled = await Promise.allSettled(ids.map(id => apiFetch<PositionRecord>('GET', `/positions/${id}`)));
      return settled
        .filter((r): r is PromiseFulfilledResult<PositionRecord> => r.status === 'fulfilled')
        .map(r => r.value);
    }
  },
  getPosition: (id: ObjectId) => apiFetch<PositionRecord>('GET', `/positions/${id}`),
  createPosition: async (data: CreatePositionRequest): Promise<PositionRecord> => {
    const result = await apiFetch<PositionRecord>('POST', '/positions', data);
    const id = result.id || result._id;
    if (id) idCache.add('positions', id);
    return result;
  },
  updatePosition: (id: ObjectId, data: UpdatePositionRequest) =>
    apiFetch<PositionRecord>('PUT', `/positions/${id}`, data),
  deletePosition: async (id: ObjectId): Promise<DeletedResponse> => {
    const result = await apiFetch<DeletedResponse>('DELETE', `/positions/${id}`);
    idCache.remove('positions', id);
    return result;
  },
  processPosition: (id: ObjectId) => apiFetch<ProcessPositionResponse>('POST', `/positions/${id}/process`),
  getPositionRanking: (id: ObjectId) => apiFetch<RankingResponse>('GET', `/positions/${id}/ranking`),

  // ── Candidates ───────────────────────────────────────
  getCandidates: async (): Promise<CandidateRecord[]> => {
    try {
      return normalizeList<CandidateRecord>(await apiFetch<unknown>('GET', '/candidates'));
    } catch {
      const ids = idCache.get('candidates');
      const settled = await Promise.allSettled(ids.map(id => apiFetch<CandidateRecord>('GET', `/candidates/${id}`)));
      return settled
        .filter((r): r is PromiseFulfilledResult<CandidateRecord> => r.status === 'fulfilled')
        .map(r => r.value);
    }
  },
  getCandidate: (id: ObjectId) => apiFetch<CandidateRecord>('GET', `/candidates/${id}`),
  createCandidate: async (data: CreateCandidateRequest): Promise<CandidateRecord> => {
    const result = await apiFetch<CandidateRecord>('POST', '/candidates', data);
    const id = result.id || result._id;
    if (id) idCache.add('candidates', id);
    return result;
  },
  updateCandidate: (id: ObjectId, data: UpdateCandidateRequest) =>
    apiFetch<CandidateRecord>('PUT', `/candidates/${id}`, data),
  deleteCandidate: async (id: ObjectId): Promise<DeletedResponse> => {
    const result = await apiFetch<DeletedResponse>('DELETE', `/candidates/${id}`);
    idCache.remove('candidates', id);
    return result;
  },
  uploadResume: async (id: ObjectId, file: File): Promise<UploadCandidateResumeResponse> => {
    const form = new FormData();
    form.append('resume', file);
    const res = await fetch(`${ATS_BASE}/candidates/${id}/upload`, {
      method: 'POST',
      headers: { 'X-Tenant-Id': 'demo' },
      body: form,
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = JSON.parse(text); msg = j.message || j.error || msg; } catch {}
      throw new Error(msg);
    }
    return (text ? JSON.parse(text) : {}) as UploadCandidateResumeResponse;
  },
  processCandidate: (id: ObjectId) => apiFetch<ProcessCandidateResponse>('POST', `/candidates/${id}/process`),

  // ── Matches ──────────────────────────────────────────
  computeMatches: (positionId: ObjectId) =>
    apiFetch<ComputeMatchesResponse>('POST', `/matches/position/${positionId}`),
};
