import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { admitDaily, DAILY_COUNTER_KEY, nextMidnight } from '../utils/daily-counter';
import {
  INSTAGRAM_LIMIT_STORAGE_KEY, LEGACY_LIMIT_STORAGE_KEY, readPostLimit, isXPage,
  X_LIMIT_STORAGE_KEY,
} from '../utils/settings';

import { INSTAGRAM_COUNTER_KEY, instagramRedirect, isInstagramFollowing } from '../utils/instagram';

export default defineBackground(() => {
  // One writer serializes read/modify/write operations from every X tab.
  let queue: Promise<unknown> = Promise.resolve();
  // Declarative rules cover full page loads. Instagram changes routes with
  // history.pushState, which does not issue a request and bypasses those rules.
  browser.webNavigation.onHistoryStateUpdated.addListener(details => {
    const redirect = instagramRedirect(details.url);
    if (redirect) void browser.tabs.update(details.tabId, { url: redirect }).catch(console.error);
  }, { url: [{ hostEquals: 'instagram.com' }, { hostEquals: 'www.instagram.com' }] });

  function update(candidates: string[], key = DAILY_COUNTER_KEY) {
    const result = queue.then(async () => {
      const limitKey = key === INSTAGRAM_COUNTER_KEY ? INSTAGRAM_LIMIT_STORAGE_KEY : X_LIMIT_STORAGE_KEY;
      const stored = await browser.storage.local.get([key, limitKey, LEGACY_LIMIT_STORAGE_KEY]);
      const limit = readPostLimit(stored[limitKey], stored[LEGACY_LIMIT_STORAGE_KEY]);
      const state = admitDaily(stored[key], candidates, limit);
      if (JSON.stringify(state) !== JSON.stringify(stored[key])) {
        await browser.storage.local.set({ [key]: state });
      }
      await browser.alarms.create('daily-reset', { when: nextMidnight() });
      return state.ids.slice(0, limit);
    });
    queue = result.catch(() => {});
    return result;
  }
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'unscrolled:admit' || (!isXPage(sender.url) && !isInstagramFollowing(sender.url)) ||
      !Array.isArray(message.ids) || message.ids.length > 2000 ||
      !message.ids.every((id: unknown) => typeof id === 'string' && /^\d+$/.test(id))) return;
    void update(message.ids, isInstagramFollowing(sender.url) ? INSTAGRAM_COUNTER_KEY : DAILY_COUNTER_KEY).then(ids => respond({ ids }), () => respond({ error: true }));
    return true;
  });
  const reset = () => Promise.all([update([]), update([], INSTAGRAM_COUNTER_KEY)]);
  browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'daily-reset') void reset().catch(console.error);
  });
  browser.runtime.onStartup.addListener(() => { void reset().catch(console.error); });
  browser.runtime.onInstalled.addListener(() => { void reset().catch(console.error); });
});
