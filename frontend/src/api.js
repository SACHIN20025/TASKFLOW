const BASE_URL = 'http://localhost:4000/api';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    // Network-level failure (backend not running, CORS, etc.)
    throw new Error('Could not reach the server. Is the backend running on port 4000?');
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_err) {
    // No JSON body (e.g. some 204s) - that's fine.
  }

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  getBoard: (boardId) => request(`/boards/${boardId}`),
  getTasks: (boardId, priority) =>
    request(`/boards/${boardId}/tasks${priority ? `?priority=${encodeURIComponent(priority)}` : ''}`),
  createTask: (task) => request('/tasks', { method: 'POST', body: JSON.stringify(task) }),
  updateTask: (id, updates) =>
    request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  moveTask: (id, columnId) =>
    request(`/tasks/${id}/move`, { method: 'PATCH', body: JSON.stringify({ columnId }) }),
};
