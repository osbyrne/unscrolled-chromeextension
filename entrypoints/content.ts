import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startLimiter } from '../utils/limiter';
import { DAILY_COUNTER_KEY, localDay, nextMidnight } from '../utils/daily-counter';
import {
  INSTAGRAM_LIMIT_STORAGE_KEY, LEGACY_LIMIT_STORAGE_KEY, readPostLimit, X_LIMIT_STORAGE_KEY,
} from '../utils/settings';

import { INSTAGRAM_COUNTER_KEY, instagramPostId, instagramRedirect, isInstagramFollowing } from '../utils/instagram';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://www.x.com/*', 'https://instagram.com/*', 'https://www.instagram.com/*'],
  runAt: 'document_start',
  async main(ctx) {
    const instagram = location.hostname.endsWith('instagram.com');
    const counterKey = instagram ? INSTAGRAM_COUNTER_KEY : DAILY_COUNTER_KEY;
    const limitKey = instagram ? INSTAGRAM_LIMIT_STORAGE_KEY : X_LIMIT_STORAGE_KEY;
    let stop: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let day = localDay();
    let generation = 0;
    async function restart() {
      const current = ++generation;
      stop?.();
      stop = undefined;
      clearTimeout(timer);
      if (!instagram && /^\/i\/history(?:\/|$)/.test(location.pathname)) return;
      if (instagram) {
        const redirect = instagramRedirect(location.href);
        if (redirect) { location.replace(redirect); return; }
        if (!isInstagramFollowing(location.href)) return;
      }
      const settings = await browser.storage.local.get([limitKey, LEGACY_LIMIT_STORAGE_KEY]);
      if (ctx.isInvalid || current !== generation) return;
      day = localDay();
      stop = startLimiter(document, readPostLimit(settings[limitKey], settings[LEGACY_LIMIT_STORAGE_KEY]), async ids => {
        const result = await browser.runtime.sendMessage({ type: 'unscrolled:admit', ids });
        if (!Array.isArray(result?.ids)) throw new Error('Daily counter unavailable');
        return result.ids;
      }, instagram ? instagramPostId : undefined);
      clearTimeout(timer);
      timer = setTimeout(() => { void restart(); }, Math.max(1, nextMidnight() - Date.now()));
    }
    const onStorage = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local') return;
      const counter = changes[counterKey]?.newValue as { day?: string } | undefined;
      if (changes[limitKey] || changes[LEGACY_LIMIT_STORAGE_KEY] || (counter?.day && counter.day !== day)) void restart();
    };
    browser.storage.onChanged.addListener(onStorage);
    ctx.addEventListener(window, 'wxt:locationchange', () => { void restart(); });
    ctx.addEventListener(document, 'visibilitychange', () => {
      if (!document.hidden && localDay() !== day) void restart();
    });
    ctx.onInvalidated(() => {
      generation++;
      stop?.();
      clearTimeout(timer);
      browser.storage.onChanged.removeListener(onStorage);
    });
    await restart();
  },
});
