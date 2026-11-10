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
