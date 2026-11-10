import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startLimiter } from '../utils/limiter';
import { LIMIT_PAUSE_KEY, readLimitPauseUntil } from '../utils/limit-pause';

import { instagramRedirect, isInstagramFollowing } from '../utils/instagram';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://www.x.com/*', 'https://instagram.com/*', 'https://www.instagram.com/*'],
  runAt: 'document_start',
  async main(ctx) {
    const instagram = location.hostname.endsWith('instagram.com');
    let stop: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let pausedUntil = 0;
    let generation = 0;
    async function restart() {
      const current = ++generation;
      clearTimeout(timer);
      pausedUntil = 0;
      if (instagram) {
        const redirect = instagramRedirect(location.href);
        if (redirect) { location.replace(redirect); return; }
      }
      if (instagram ? !isInstagramFollowing(location.href) : /^\/i\/history(?:\/|$)/.test(location.pathname)) {
        stop?.();
        stop = undefined;
        return;
      }
      stop ??= startLimiter(document, instagram ? 'instagram' : 'x');
      const settings = await browser.storage.local.get(LIMIT_PAUSE_KEY).catch(() => undefined);
      if (ctx.isInvalid || current !== generation) return;
      pausedUntil = readLimitPauseUntil(settings?.[LIMIT_PAUSE_KEY]);
      if (pausedUntil > Date.now()) {
        stop();
        stop = undefined;
        timer = setTimeout(() => { void restart(); }, pausedUntil - Date.now());
        return;
      }
      pausedUntil = 0;
    }
    const onStorage = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[LIMIT_PAUSE_KEY]) void restart();
    };
    browser.storage.onChanged.addListener(onStorage);
    ctx.addEventListener(window, 'wxt:locationchange', () => { void restart(); });
    ctx.addEventListener(document, 'visibilitychange', () => {
      if (!document.hidden && pausedUntil > 0 && pausedUntil <= Date.now()) void restart();
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
