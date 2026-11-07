// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { instagramPostId, instagramRedirect, isInstagramFollowing } from '../utils/instagram';
import { startLimiter } from '../utils/limiter';

describe('Instagram', () => {
  it('redirects only the home page and Reels section', () => {
    expect(instagramRedirect('https://instagram.com')).toBe('https://www.instagram.com/?variant=following');
    expect(instagramRedirect('https://www.instagram.com/?variant=home')).toBe('https://www.instagram.com/?variant=following');
    expect(instagramRedirect('https://www.instagram.com/reels/abc/')).toBe('https://www.instagram.com/direct/');
    for (const path of ['/?variant=following', '/direct/', '/direct/inbox/', '/person/', '/p/abc/', '/reel/abc/']) {
      expect(instagramRedirect(`https://www.instagram.com${path}`)).toBeUndefined();
    }
    expect(isInstagramFollowing('https://www.instagram.com/?variant=following')).toBe(true);
    expect(isInstagramFollowing('https://www.instagram.com/direct/?variant=following')).toBe(false);
  });

  it('limits distinct Instagram posts and restores the page on cleanup', () => {
    document.body.innerHTML = '<main><div>' + ['Ab_1', 'Ab_1', 'Cd-2', 'Ef3'].map(id =>
      `<article><a href="/p/${id}/"><time>now</time></a></article>`).join('') + '</div></main>';
    const stop = startLimiter(document, 2, undefined, instagramPostId);
    try {
      expect(document.querySelectorAll('article:not([data-unscrolled-hidden])')).toHaveLength(3);
      expect(document.querySelector('footer p')?.textContent).toBe("you've seen 2 posts, it's time to focus now.");
      expect(document.querySelector('footer')?.textContent).not.toContain('Unscrolled ·');
    } finally { stop(); }
    expect(document.querySelector('[data-unscrolled-hidden]')).toBeNull();
    expect(document.querySelector('footer')).toBeNull();
    document.body.innerHTML = '';
  });
});
