import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { admitDaily, DAILY_COUNTER_KEY, nextMidnight } from '../utils/daily-counter';
import { LIMIT_STORAGE_KEY, readPostLimit, isXPage } from '../utils/settings';

export default defineBackground(() => {
  // One writer serializes read/modify/write operations from every X tab.
  let queue: Promise<unknown> = Promise.resolve();
  function update(candidates: string[]) {
    const result = queue.then(async () => {
      const stored = await browser.storage.local.get([DAILY_COUNTER_KEY, LIMIT_STORAGE_KEY]);
      const limit = readPostLimit(stored[LIMIT_STORAGE_KEY]);
      const state = admitDaily(stored[DAILY_COUNTER_KEY], candidates, limit);
      if (JSON.stringify(state) !== JSON.stringify(stored[DAILY_COUNTER_KEY])) {
        await browser.storage.local.set({ [DAILY_COUNTER_KEY]: state });
      }
      await browser.alarms.create('daily-reset', { when: nextMidnight() });
      return state.ids.slice(0, limit);
    });
    queue = result.catch(() => {});
    return result;
  }
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'unscrolled:admit' || !isXPage(sender.url) ||
      !Array.isArray(message.ids) || message.ids.length > 2000 ||
      !message.ids.every((id: unknown) => typeof id === 'string' && /^\d+$/.test(id))) return;
    void update(message.ids).then(ids => respond({ ids }), () => respond({ error: true }));
    return true;
  });
  browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'daily-reset') void update([]).catch(console.error);
  });
  browser.runtime.onStartup.addListener(() => { void update([]).catch(console.error); });
  browser.runtime.onInstalled.addListener(() => { void update([]).catch(console.error); });
});
