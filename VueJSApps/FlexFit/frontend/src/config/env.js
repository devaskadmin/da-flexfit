const rawApiBase = import.meta.env.VITE_API_BASE || '';

export const API_BASE = rawApiBase.replace(/\/$/, '');

if (!API_BASE) {
  console.error('Missing VITE_API_BASE. Set it in frontend/.env or frontend/.env.local.');
}