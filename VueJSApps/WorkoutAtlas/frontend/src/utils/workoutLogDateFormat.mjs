const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseDateOnlyToLocalDate = (rawValue) => {
  const [yearText, monthText, dayText] = String(rawValue || '').split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

export const parseLocalDateValue = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return null;
  }

  if (DATE_ONLY_RE.test(rawValue)) {
    return parseDateOnlyToLocalDate(rawValue);
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const dateOnlyPrefix = rawValue.slice(0, 10);
  if (DATE_ONLY_RE.test(dateOnlyPrefix)) {
    return parseDateOnlyToLocalDate(dateOnlyPrefix);
  }

  return null;
};

export const toLocalDateInputValue = (value = new Date()) => {
  const parsed = value instanceof Date ? value : parseLocalDateValue(value);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return '';
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeDateInputValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (DATE_ONLY_RE.test(raw)) {
    return raw;
  }
  return toLocalDateInputValue(raw);
};

export const formatLocalDateLabel = (value, { weekday = true, compact = false } = {}) => {
  const parsed = parseLocalDateValue(value);
  if (!parsed) {
    return 'Date unavailable';
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: weekday ? 'long' : undefined,
    month: compact ? 'short' : 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return formatter.format(parsed);
};

export const formatLocalDateTimeLabel = (value) => {
  const parsed = parseLocalDateValue(value);
  if (!parsed) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
};
