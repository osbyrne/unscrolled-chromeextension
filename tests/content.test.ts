// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface TestContext {
  isInvalid: boolean;
  addEventListener: (target: EventTarget, event: string, listener: EventListener) => void;
  onInvalidated: (callback: () => void) => void;
}
const entrypoint = vi.hoisted(() => ({ main: async (_ctx: TestContext) => {} }));
const api = vi.hoisted(() => ({
  storage: {
    local: { get: vi.fn() },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
vi.mock('wxt/utils/define-content-script', () => ({
  defineContentScript: (config: typeof entrypoint) => { entrypoint.main = config.main; return config; },
}));

let saved: Record<string, unknown>;
let context: TestContext;
let invalidate: () => void;
let events: AbortController;
const flush = () => vi.advanceTimersByTimeAsync(0);
const visible = () => [...document.querySelectorAll('article')].filter(node => getComputedStyle(node).visibility !== 'hidden');
const changePause = async (until: number) => {
  saved.postLimitsPausedUntil = until;
  api.storage.onChanged.addListener.mock.calls[0]![0]({ postLimitsPausedUntil: { newValue: until } }, 'local');
  await flush();
};
const mount = async (instagram = false) => {
  vi.stubGlobal('location', new URL(instagram ? 'https://www.instagram.com/?variant=following' : 'https://x.com/home'));
  document.body.innerHTML = instagram
    ? '<main><div>' + [1, 2, 3].map(id => `<article><a href="/p/${id}/"><time>now</time></a></article>`).join('') + '</div></main>'
    : '<main data-testid="primaryColumn"><div>' + [1, 2, 3].map(id =>
      `<div data-testid="cellInnerDiv"><article data-testid="tweet"><a href="/person/status/${id}"><time>now</time></a></article></div>`,
    ).join('') + '</div></main>';
  await entrypoint.main(context);
  await flush();
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.resetAllMocks();
  saved = {};
  events = new AbortController();
  context = {
    isInvalid: false,
    addEventListener: (target, event, listener) => target.addEventListener(event, listener, { signal: events.signal }),
    onInvalidated: callback => { invalidate = callback; },
  };
  api.storage.local.get.mockImplementation(async () => ({ ...saved }));
  await import('../entrypoints/content');
});
afterEach(() => {
  context.isInvalid = true;
  invalidate?.();
  events.abort();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('temporary post limit pause', () => {
  it('blocks while storage is loading and opens only after confirming an active pause', async () => {
    let finishRead = (_value: Record<string, unknown>) => {};
    api.storage.local.get.mockReturnValueOnce(new Promise<Record<string, unknown>>(resolve => { finishRead = resolve; }));
    const loading = mount();
    expect(visible()).toHaveLength(0);
    finishRead({ postLimitsPausedUntil: Date.now() + 180_000 });
    await loading;
    expect(visible()).toHaveLength(3);
  });

  it('keeps blocking when the pause setting cannot be read', async () => {
    api.storage.local.get.mockRejectedValueOnce(new Error('Storage unavailable'));
    await mount();
    expect(visible()).toHaveLength(0);
    expect(document.querySelector('footer')).not.toBeNull();
  });
  it.each([false, true])('blocks immediately despite previous count settings (Instagram: %s)', async instagram => {
    saved = { xPostLimit: 50, instagramPostLimit: 50, postLimit: 50 };
    await mount(instagram);
    expect(visible()).toHaveLength(0);
    expect(document.querySelector('footer p')?.textContent).toBe("it's time to focus now.");
  });
  it.each([false, true])('unhides the feed immediately and reapplies its limit after three minutes (Instagram: %s)', async instagram => {
    await mount(instagram);
    expect(visible()).toHaveLength(0);
    expect(document.querySelector('footer')).not.toBeNull();
    await changePause(Date.now() + 180_000);
    expect(visible()).toHaveLength(3);
    expect(document.querySelector('footer')).toBeNull();
    await vi.advanceTimersByTimeAsync(179_999);
    expect(visible()).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(visible()).toHaveLength(0);
    expect(document.querySelector('footer')).not.toBeNull();
  });

  it('honors a saved pause on a new page without renewing its expiry', async () => {
    saved.postLimitsPausedUntil = Date.now() + 60_000;
    await mount();
    expect(visible()).toHaveLength(3);
    window.dispatchEvent(new Event('wxt:locationchange'));
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(visible()).toHaveLength(0);
  });

  it('can resume limits before the pause expires', async () => {
    saved.postLimitsPausedUntil = Date.now() + 180_000;
    await mount();
    await changePause(0);
    expect(visible()).toHaveLength(0);
    expect(document.querySelector('footer')).not.toBeNull();
  });

  it('checks the expiry when a sleeping tab becomes visible', async () => {
    saved.postLimitsPausedUntil = Date.now() + 180_000;
    await mount();
    vi.setSystemTime(Date.now() + 180_001);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(visible()).toHaveLength(0);
  });

  it('ignores an expired saved pause', async () => {
    saved.postLimitsPausedUntil = Date.now() - 1;
    await mount();
    expect(visible()).toHaveLength(0);
  });

  it.each([
    [false, 'https://x.com/i/history', 'https://x.com/home'],
    [true, 'https://www.instagram.com/direct/', 'https://www.instagram.com/?variant=following'],
  ])('restores excluded routes and blocks again when returning (Instagram: %s)', async (instagram, excluded, feed) => {
    await mount(instagram);
    vi.stubGlobal('location', new URL(excluded));
    window.dispatchEvent(new Event('wxt:locationchange'));
    await flush();
    expect(visible()).toHaveLength(3);
    expect(document.querySelector('footer')).toBeNull();
    vi.stubGlobal('location', new URL(feed));
    window.dispatchEvent(new Event('wxt:locationchange'));
    await flush();
    expect(visible()).toHaveLength(0);
  });
});
