import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startLimiter } from '../utils/limiter';
import { LIMIT_STORAGE_KEY, readPostLimit } from '../utils/settings';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://www.x.com/*'],
  runAt: 'document_start',
  async main(ctx) {
    const settings = await browser.storage.local.get(LIMIT_STORAGE_KEY);
    if (ctx.isInvalid) return;
    const stop = startLimiter(document, readPostLimit(settings[LIMIT_STORAGE_KEY]));
    ctx.onInvalidated(stop);
  },
});
