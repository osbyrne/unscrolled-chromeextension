export const LIMIT_PAUSE_KEY = 'postLimitsPausedUntil';
export const LIMIT_PAUSE_DURATION = 3 * 60 * 1000;
export const LIMIT_PAUSE_DELAY = 6 * 1000;

export function readLimitPauseUntil(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}
