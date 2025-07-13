// src/api/fatsecretSession.js
export async function getFatSecretToken() {
  const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/get-fatsecret-session`);
  if (!res.ok) throw new Error('Failed to get FatSecret token');
  return await res.json();
}
