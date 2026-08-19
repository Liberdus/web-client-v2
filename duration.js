export const DURATION_MINUTE_MS = 60 * 1000;
export const DURATION_HOUR_MS = 60 * DURATION_MINUTE_MS;
export const DURATION_DAY_MS = 24 * DURATION_HOUR_MS;

export function durationPartsToMilliseconds(days, hours, minutes) {
  const parts = [days, hours, minutes].map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 0)) return NaN;
  if (parts[1] > 23 || parts[2] > 59) return NaN;
  const milliseconds = (parts[0] * DURATION_DAY_MS)
    + (parts[1] * DURATION_HOUR_MS)
    + (parts[2] * DURATION_MINUTE_MS);
  return Number.isSafeInteger(milliseconds) ? milliseconds : NaN;
}

export function millisecondsToDurationParts(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isSafeInteger(value) || value < 0 || value % DURATION_MINUTE_MS !== 0) return null;
  const days = Math.floor(value / DURATION_DAY_MS);
  const remainder = value % DURATION_DAY_MS;
  const hours = Math.floor(remainder / DURATION_HOUR_MS);
  const minutes = Math.floor((remainder % DURATION_HOUR_MS) / DURATION_MINUTE_MS);
  return { days, hours, minutes };
}

export function formatDurationParts(milliseconds) {
  const parts = millisecondsToDurationParts(milliseconds);
  if (!parts) return '';
  if (milliseconds === 0) return '0 minutes';
  return [
    [parts.days, 'day'],
    [parts.hours, 'hour'],
    [parts.minutes, 'minute'],
  ]
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value} ${unit}${value === 1 ? '' : 's'}`)
    .join(' ');
}
