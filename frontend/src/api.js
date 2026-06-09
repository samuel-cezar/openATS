const ATS_BASE = 'http://localhost:3000/api/v1';
const ATS_HEADERS = {
  'Content-Type': 'application/json',
  'X-Tenant-Id': 'demo',
};

async function apiFetch(method, path, body) {
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
  return text ? JSON.parse(text) : {};
}

const idCache = {
  get(key) {
    try { return JSON.parse(localStorage.getItem('ats_ids_' + key)) || []; }
    catch { return []; }
  },
  add(key, id) {
    const ids = this.get(key);
    if (!ids.includes(String(id))) {
      ids.unshift(String(id));
      localStorage.setItem('ats_ids_' + key, JSON.stringify(ids));
    }
  },
  remove(key, id) {
    const ids = this.get(key).filter(x => x !== String(id));
    localStorage.setItem('ats_ids_' + key, JSON.stringify(ids));
  },
};

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export const api = {
  // ── Selection Processes ──────────────────────────────
  getProcesses: () => apiFetch('GET', '/selection-processes').then(normalizeList),
  getProcess: (id) => apiFetch('GET', `/selection-processes/${id}`),
  createProcess: (data) => apiFetch('POST', '/selection-processes', data),
  updateProcess: (id, data) => apiFetch('PUT', `/selection-processes/${id}`, data),
  deleteProcess: (id) => apiFetch('DELETE', `/selection-processes/${id}`),

  // ── Positions ────────────────────────────────────────
  getPositions: async () => {
    try {
      return normalizeList(await apiFetch('GET', '/positions'));
    } catch {
      const ids = idCache.get('positions');
      const settled = await Promise.allSettled(ids.map(id => apiFetch('GET', `/positions/${id}`)));
      return settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    }
  },
  getPosition: (id) => apiFetch('GET', `/positions/${id}`),
  createPosition: async (data) => {
    const result = await apiFetch('POST', '/positions', data);
    const id = result.id || result._id;
    if (id) idCache.add('positions', id);
    return result;
  },
  updatePosition: (id, data) => apiFetch('PUT', `/positions/${id}`, data),
  deletePosition: async (id) => {
    const result = await apiFetch('DELETE', `/positions/${id}`);
    idCache.remove('positions', id);
    return result;
  },
  processPosition: (id) => apiFetch('POST', `/positions/${id}/process`),
  getPositionRanking: (id) => apiFetch('GET', `/positions/${id}/ranking`),

  // ── Candidates ───────────────────────────────────────
  getCandidates: async () => {
    try {
      return normalizeList(await apiFetch('GET', '/candidates'));
    } catch {
      const ids = idCache.get('candidates');
      const settled = await Promise.allSettled(ids.map(id => apiFetch('GET', `/candidates/${id}`)));
      return settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    }
  },
  getCandidate: (id) => apiFetch('GET', `/candidates/${id}`),
  createCandidate: async (data) => {
    const result = await apiFetch('POST', '/candidates', data);
    const id = result.id || result._id;
    if (id) idCache.add('candidates', id);
    return result;
  },
  updateCandidate: (id, data) => apiFetch('PUT', `/candidates/${id}`, data),
  deleteCandidate: async (id) => {
    const result = await apiFetch('DELETE', `/candidates/${id}`);
    idCache.remove('candidates', id);
    return result;
  },
  uploadResume: async (id, file) => {
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
    return text ? JSON.parse(text) : {};
  },
  processCandidate: (id) => apiFetch('POST', `/candidates/${id}/process`),

  // ── Matches ──────────────────────────────────────────
  computeMatches: (positionId) => apiFetch('POST', `/matches/position/${positionId}`),
};
