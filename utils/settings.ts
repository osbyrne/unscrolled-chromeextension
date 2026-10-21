export const DEFAULT_POST_LIMIT = 100;
export const LIMIT_STORAGE_KEY = 'postLimit';

export function isPostLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 999;
}

export function readPostLimit(value: unknown): number {
  return isPostLimit(value) ? value : DEFAULT_POST_LIMIT;
}

export function footerMessage(limit: number): string {
  if (limit === 100) return "you've seen a hundred posts, it's time to focus now.";
  return `you've seen ${limit} ${limit === 1 ? 'post' : 'posts'}, it's time to focus now.`;
}

export function isXPage(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ['x.com', 'www.x.com'].includes(parsed.hostname);
  } catch {
    return false;
  }
}
