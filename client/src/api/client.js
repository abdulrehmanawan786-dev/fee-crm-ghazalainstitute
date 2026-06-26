const API_BASE = import.meta.env.VITE_API_URL || '/api';
const ROOT_BASE = API_BASE.replace(/\/api\/?$/, '');
let token = localStorage.getItem('ghazala_fees_token') || null;
let role = localStorage.getItem('ghazala_fees_role') || null;
export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('ghazala_fees_token', t);
  else localStorage.removeItem('ghazala_fees_token');
}
export function getToken() {
  return token;
}
export function setRole(r) {
  role = r;
  if (r) localStorage.setItem('ghazala_fees_role', r);
  else localStorage.removeItem('ghazala_fees_role');
}
export function getRole() {
  return role;
}
async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    setRole(null);
    window.dispatchEvent(new Event('ghazala-auth-expired'));
    throw new Error('Session expired. Please log in again.');
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.blob();
  if (!res.ok) {
    throw new Error((isJson && data.error) || 'Something went wrong.');
  }
  return data;
}
export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  forgotPassword: () =>
    request('/auth/forgot-password', { method: 'POST' }),
  resetPassword: (token, newPassword) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  sendReminders: () => request('/reminders/send', { method: 'POST' }),
  reminderLogs: () => request('/reminders/logs'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  loginHistory: () => request('/auth/login-history'),
  listUsers: () => request('/users'),
  createUser: (username, password, role) => request('/users', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  listStudents: (params) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
    return request(`/students?${qs}`);
  },
  getStudent: (id) => request(`/students/${id}`),
  createStudent: (data) => request('/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id, data) => request(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),
  markPaid: (id, type, method) => request(`/students/${id}/payments/${type}/pay`, { method: 'POST', body: JSON.stringify({ method }) }),
  unmarkPaid: (id, type) => request(`/students/${id}/payments/${type}/unpay`, { method: 'POST' }),
  dashboard: (month) => request(`/dashboard?month=${month}`),
  overdue: () => request('/dashboard/overdue'),
  pendingImages: () => request('/dashboard/pending-images'),
  byIds: (ids) => request('/dashboard/by-ids', { method: 'POST', body: JSON.stringify({ ids }) }),
  listImages: (studentId) => request(`/images/${studentId}`),
  uploadImages: (studentId, files) => {
    const form = new FormData();
    files.forEach(f => form.append('images', f));
    return request(`/images/${studentId}`, { method: 'POST', body: form });
  },
  deleteImage: (imageId) => request(`/images/image/${imageId}`, { method: 'DELETE' }),
  imageBlobUrl: async (filename) => {
    const res = await fetch(`${ROOT_BASE}/uploads/${filename}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Could not load image.');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  exportCsvUrl: async () => {
    const blob = await request('/export/csv');
    return URL.createObjectURL(blob);
  },
};
