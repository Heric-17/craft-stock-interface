import { NON_BREAKING_SPACE } from './decimal';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

function plural(count: number, one: string, many: string): string {
  return `${count}${NON_BREAKING_SPACE}${count === 1 ? one : many}`;
}

/**
 * A wait, written the way someone says it: "45 segundos", "12 minutos",
 * "1 hora e 5 minutos".
 *
 * It rounds **up** and stops at the minute from a minute on. A wait of 61
 * seconds read as "1 minuto" would send the person back a second too early, and
 * the point of saying how long is that the next try works.
 */
export function formatWait(totalSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(totalSeconds));

  if (seconds < SECONDS_PER_MINUTE) {
    return plural(seconds, 'segundo', 'segundos');
  }

  const totalMinutes = Math.ceil(seconds / SECONDS_PER_MINUTE);

  if (totalMinutes < MINUTES_PER_HOUR) {
    return plural(totalMinutes, 'minuto', 'minutos');
  }

  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  return minutes === 0
    ? plural(hours, 'hora', 'horas')
    : `${plural(hours, 'hora', 'horas')} e ${plural(minutes, 'minuto', 'minutos')}`;
}

function twoDigits(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

/**
 * The running clock of a wait: `0:45`, `12:34`, `1:05:00`. For a number that
 * changes every second, where "12 minutos" would sit still for a minute and look
 * frozen.
 */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR));
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR;
  const rest = seconds % SECONDS_PER_MINUTE;

  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${twoDigits(rest)}`
    : `${minutes}:${twoDigits(rest)}`;
}
