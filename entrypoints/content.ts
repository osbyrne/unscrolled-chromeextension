import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startLimiter } from '../utils/limiter';
import { DAILY_COUNTER_KEY, localDay, nextMidnight } from '../utils/daily-counter';
import { LIMIT_STORAGE_KEY, readPostLimit } from '../utils/settings';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://www.x.com/*'],
  runAt: 'document_start',
  async main(ctx) {
    let stop: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let day = localDay();
    let generation = 0;
    async function restart() {
      const current = ++generation;
      const settings = await browser.storage.local.get(LIMIT_STORAGE_KEY);
      if (ctx.isInvalid || current !== generation) return;
      stop?.();
      day = localDay();
      stop = startLimiter(document, readPostLimit(settings[LIMIT_STORAGE_KEY]), async ids => {
        const result = await browser.runtime.sendMessage({ type: 'unscrolled:admit', ids });
        if (!Array.isArray(result?.ids)) throw new Error('Daily counter unavailable');
        return result.ids;
      });
      clearTimeout(timer);
      timer = setTimeout(() => { void restart(); }, Math.max(1, nextMidnight() - Date.now()));
    }
    const onStorage = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local') return;
      const counter = changes[DAILY_COUNTER_KEY]?.newValue as { day?: string } | undefined;
      if (changes[LIMIT_STORAGE_KEY] || (counter?.day && counter.day !== day)) void restart();
    };
    browser.storage.onChanged.addListener(onStorage);
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
