const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const SENSITIVE_PATTERN = /(password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|cookie|set-cookie|secret|api[_-]?key|hmac|db_password|db_user|db_host|database|sqlstate|stack trace|select\s+.+\s+from|insert\s+into|update\s+.+\s+set)/i;

const SAFE_VALIDATION_PATTERN = /(incompatible|validation|required|must be|characters? or fewer|cannot proceed|already exists|blocked|blocker|unsupported target|marketplace plan conversion is not implemented)/i;

export function isLocalhostRuntime(hostname = '') {
  const value = String(hostname || (typeof window !== 'undefined' ? window.location.hostname : '')).trim().toLowerCase();
  return LOCAL_HOSTNAMES.has(value);
}

export function normalizeRoleSlug(roleValue = '') {
  const role = String(roleValue || '').trim().toLowerCase();
  if (role === 'administrator') return 'admin';
  if (role === 'member') return 'user';
  return role || 'user';
}

export function canViewTechnicalDiagnostics({ roleSlug = '', hostname = '' } = {}) {
  return isLocalhostRuntime(hostname) || normalizeRoleSlug(roleSlug) === 'admin';
}

export function sanitizeDiagnosticText(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'n/a';

  const redacted = raw
    .replace(/(password|passwd|pwd)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/(token|access[_-]?token|refresh[_-]?token|id[_-]?token)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/(authorization)\s*[:=]\s*[^\n]+/gi, '$1: [redacted]')
    .replace(/(cookie|set-cookie)\s*[:=]\s*[^\n]+/gi, '$1: [redacted]')
    .replace(/(secret|api[_-]?key|hmac|db_password|db_user|db_host)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]');

  return redacted.split(/\r?\n/)[0].trim().slice(0, 300) || 'n/a';
}

export function buildFriendlyMessage({
  status,
  code = '',
  rawMessage = '',
  category = 'generic',
  fallback = 'Unable to complete your request. Please try again.',
  preserveValidation = true,
} = {}) {
  const message = String(rawMessage || '').trim();
  const lower = message.toLowerCase();

  if (status === 429 || /too many|rate\s*limit|try again in/i.test(message)) {
    return message || 'Too many attempts. Please wait a moment and try again.';
  }

  if (preserveValidation && SAFE_VALIDATION_PATTERN.test(message)) {
    return message;
  }

  if (status === 401) {
    if (category === 'auth') {
      return 'Incorrect email or password. Please try again.';
    }
    return 'Your session has expired. Please sign in again.';
  }

  if (status === 403) {
    return "You don't have permission to perform this action.";
  }

  if (!status || status >= 500 || /network|failed to fetch|econnrefused|timeout|temporarily unavailable/i.test(lower)) {
    if (category === 'ai') {
      return 'AI Assistant is temporarily unavailable. Please try again later.';
    }
    if (category === 'save') {
      return 'Unable to save your workout. Please try again.';
    }
    return 'Unable to connect. Please try again later.';
  }

  if (category === 'save') {
    return 'Unable to save your workout. Please try again.';
  }

  if (category === 'ai') {
    return 'AI Assistant is temporarily unavailable. Please try again later.';
  }

  if (SENSITIVE_PATTERN.test(lower)) {
    return fallback;
  }

  return message || fallback;
}

export function buildDiagnosticsPayload({
  status,
  code = '',
  requestId = '',
  service = '',
  rawMessage = '',
} = {}) {
  return {
    status: status ?? 'n/a',
    code: sanitizeDiagnosticText(code || 'n/a'),
    requestId: sanitizeDiagnosticText(requestId || 'n/a'),
    service: sanitizeDiagnosticText(service || 'n/a'),
    timestamp: new Date().toISOString(),
    message: sanitizeDiagnosticText(rawMessage || 'n/a'),
  };
}
