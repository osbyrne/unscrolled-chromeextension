export const MAX_POST_LIMIT = 50;
export const DEFAULT_POST_LIMIT = 50;
export const X_LIMIT_STORAGE_KEY = 'xPostLimit';
export const INSTAGRAM_LIMIT_STORAGE_KEY = 'instagramPostLimit';
export const LEGACY_LIMIT_STORAGE_KEY = 'postLimit';

export function isPostLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_POST_LIMIT;
}

function storedLimit(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? Math.min(value, MAX_POST_LIMIT)
    : undefined;
}

// Carry the old shared setting forward when either site's separate setting is unset.
export function readPostLimit(value: unknown, legacyValue?: unknown): number {
  return storedLimit(value) ?? storedLimit(legacyValue) ?? DEFAULT_POST_LIMIT;
}

export function footerMessage(limit: number): string {
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
