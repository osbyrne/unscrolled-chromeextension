import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { instagramRedirect } from '../utils/instagram';

export default defineBackground(() => {
  // Declarative rules cover full page loads. Instagram changes routes with
  // history.pushState, which does not issue a request and bypasses those rules.
  browser.webNavigation.onHistoryStateUpdated.addListener(details => {
    const redirect = instagramRedirect(details.url);
    if (redirect) void browser.tabs.update(details.tabId, { url: redirect }).catch(console.error);
  }, { url: [{ hostEquals: 'instagram.com' }, { hostEquals: 'www.instagram.com' }] });
});
