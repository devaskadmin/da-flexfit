const rawApiBase = import.meta.env.VITE_API_BASE || '';

const normalizeApiBase = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  // Mobile/LAN dev convenience:
  // If VITE_API_BASE points to localhost, replace host with current page hostname
  // so iPhone/Android browsers can still reach backend on the same machine.
  try {
    if (typeof window !== 'undefined') {
      const url = new URL(trimmed);
      const isLocalHost = ['localhost', '127.0.0.1'].includes(url.hostname);
      const currentHost = window.location.hostname;
      const isCurrentLocal = ['localhost', '127.0.0.1'].includes(currentHost);

      if (isLocalHost && currentHost && !isCurrentLocal) {
        url.hostname = currentHost;
        return url.toString().replace(/\/$/, '');
      }
    }
  } catch (_) {
    // Keep original value if URL parsing fails.
  }

  return trimmed.replace(/\/$/, '');
};

export const API_BASE = normalizeApiBase(rawApiBase);

if (!API_BASE) {
  console.error('Missing VITE_API_BASE. Set it in frontend/.env or frontend/.env.local.');
}