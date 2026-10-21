export const DAILY_COUNTER_KEY = 'dailyCounter';
export interface DailyCounter { day: string; ids: string[] }
export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function nextMidnight(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
}
export function admitDaily(value: unknown, candidates: string[], limit: number, now = new Date()): DailyCounter {
  const day = localDay(now);
  const previous = value as Partial<DailyCounter> | null;
  const ids = previous?.day === day && Array.isArray(previous.ids)
    ? [...new Set(previous.ids.filter(id => typeof id === 'string' && /^\d+$/.test(id)))].slice(0, 999) : [];
  const seen = new Set(ids);
  for (const id of candidates) {
    if (ids.length >= limit) break;
    if (/^\d+$/.test(id) && !seen.has(id)) { ids.push(id); seen.add(id); }
  }
  return { day, ids };
}
