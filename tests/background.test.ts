import { beforeEach, describe, expect, it, vi } from 'vitest';

const entrypoint = vi.hoisted(() => ({ main: () => {} }));
const api = vi.hoisted(() => ({
  webNavigation: { onHistoryStateUpdated: { addListener: vi.fn() } },
  tabs: { update: vi.fn() },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
vi.mock('wxt/utils/define-background', () => ({
  defineBackground: (main: () => void) => { entrypoint.main = main; return main; },
}));

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  api.tabs.update.mockResolvedValue(undefined);
  await import('../entrypoints/background');
  entrypoint.main();
});

describe('Instagram navigation', () => {
  it.each([
    ['https://www.instagram.com/', 'https://www.instagram.com/?variant=following'],
    ['https://www.instagram.com/reels/abc/', 'https://www.instagram.com/direct/'],
  ])('redirects in-app navigation from %s', (url, destination) => {
    const onNavigation = api.webNavigation.onHistoryStateUpdated.addListener.mock.calls[0]![0];
    onNavigation({ url, tabId: 7 });
    expect(api.tabs.update).toHaveBeenCalledExactlyOnceWith(7, { url: destination });
  });

  it('leaves Following and Direct navigation unchanged', () => {
    const onNavigation = api.webNavigation.onHistoryStateUpdated.addListener.mock.calls[0]![0];
    onNavigation({ url: 'https://www.instagram.com/?variant=following', tabId: 7 });
    onNavigation({ url: 'https://www.instagram.com/direct/', tabId: 7 });
    expect(api.tabs.update).not.toHaveBeenCalled();
  });
});
