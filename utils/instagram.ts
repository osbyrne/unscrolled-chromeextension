export const INSTAGRAM_COUNTER_KEY = 'instagramDailyCounter';

export function isInstagramFollowing(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(parsed.hostname) &&
      parsed.pathname === '/' && parsed.searchParams.get('variant') === 'following';
  } catch { return false; }
}

export function instagramRedirect(url: string): string | undefined {
  const parsed = new URL(url);
  if (!['instagram.com', 'www.instagram.com'].includes(parsed.hostname)) return;
  if (/^\/reels(?:\/|$)/.test(parsed.pathname)) return 'https://www.instagram.com/direct/';
  if (parsed.pathname === '/' && parsed.searchParams.get('variant') !== 'following') {
    return 'https://www.instagram.com/?variant=following';
  }
}

// Encode case-sensitive shortcodes as numeric IDs for the existing durable counter.
export function instagramPostId(article: Element): string | undefined {
  for (const anchor of article.querySelectorAll('a[href]')) {
    const code = anchor.getAttribute('href')?.match(/^\/(?:p|reel)\/([\w-]+)(?:\/|$)/)?.[1];
    if (code) return [...code].map(char => String(char.charCodeAt(0)).padStart(3, '0')).join('');
  }
}
