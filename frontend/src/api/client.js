// The single fetch client every page imports from. No demo-data
// fallback exists in this project (unlike the prior prototype) — per
// the master prompt, the frontend always calls the real backend, and
// shows a real error/loading/empty state when that backend doesn't
// have the answer yet (e.g., before Phase 5+ implement an endpoint).
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let authToken = null;
let onUnauthorized = () => {};

export function setAuthToken(token) { authToken = token; }
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function apiFetch(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw { error: 'Could not reach the server. Check your connection and that the backend is running.' };
  }

  let data = {};
  try { data = await res.json(); } catch { /* some responses have no body */ }

  if (res.status === 401) {
    authToken = null;
    onUnauthorized();
    throw { error: data.error || 'Your session has expired. Please log in again.' };
  }
  if (!res.ok) throw data.error ? data : { error: 'Something went wrong. Please try again.' };
  return data;
}

export function genIdempotencyKey() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
