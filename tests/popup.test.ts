// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  storage: { local: { get: vi.fn(), set: vi.fn() }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
const markup = readFileSync('entrypoints/popup/index.html', 'utf8');
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const pauseButton = () => document.querySelector<HTMLButtonElement>('#pause-limits')!;
const mountPopup = async () => {
  window.dispatchEvent(new Event('pagehide'));
  vi.resetModules();
  document.body.innerHTML = markup.match(/<body>([\s\S]*)<\/body>/)![1]!;
  await import('../entrypoints/popup/main');
  await settle();
};
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  api.storage.local.get.mockResolvedValue({});
  api.storage.local.set.mockResolvedValue(undefined);
  await mountPopup();
});
afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('three-minute pause toggle', () => {
  it('shows the pause control without count selectors or daily reset copy', () => {
    expect(pauseButton().textContent).toBe('Pause limits for 3 minutes');
    expect(document.querySelector('input, select, form')).toBeNull();
    expect(document.body.textContent).not.toContain('midnight');
  });
  it('waits six seconds before pausing for three minutes and can resume early', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    pauseButton().click();
    expect(pauseButton().textContent).toBe('Cancel pause (6s)');
    expect(pauseButton().getAttribute('aria-pressed')).toBe('false');
    await vi.advanceTimersByTimeAsync(5999);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.storage.local.set).toHaveBeenLastCalledWith({ postLimitsPausedUntil: now + 6000 + 180_000 });
    expect(pauseButton().getAttribute('aria-pressed')).toBe('true');
    expect(pauseButton().textContent).toBe('Resume limits now');
    expect(document.querySelector('#pause-status')?.textContent).toContain('3:00 on X and Instagram');
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.querySelector('#pause-status')?.textContent).toContain('2:59');
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.storage.local.set).toHaveBeenLastCalledWith({ postLimitsPausedUntil: 0 });
    expect(pauseButton().getAttribute('aria-pressed')).toBe('false');
  });

  it('loads the original expiry when reopened', async () => {
    api.storage.local.get.mockResolvedValue({ postLimitsPausedUntil: Date.now() + 60_000 });
    await mountPopup();
    expect(pauseButton().getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('#pause-status')?.textContent).toContain('1:00');
  });

  it('turns off automatically when the countdown expires', async () => {
    vi.useFakeTimers();
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(6000 + 179_999);
    expect(pauseButton().getAttribute('aria-pressed')).toBe('true');
    await vi.advanceTimersByTimeAsync(1);
    expect(pauseButton().getAttribute('aria-pressed')).toBe('false');
    expect(pauseButton().textContent).toBe('Pause limits for 3 minutes');
  });

  it('updates the countdown when another popup changes the pause', async () => {
    const onStorage = api.storage.onChanged.addListener.mock.calls.at(-1)![0];
    onStorage({ postLimitsPausedUntil: { newValue: Date.now() + 180_000 } }, 'local');
    expect(pauseButton().getAttribute('aria-pressed')).toBe('true');
    onStorage({ postLimitsPausedUntil: { newValue: 0 } }, 'local');
    expect(pauseButton().getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the previous state on a failed write and allows retrying', async () => {
    vi.useFakeTimers();
    api.storage.local.set.mockRejectedValueOnce(new Error('Storage unavailable'));
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(6000);
    expect(pauseButton().getAttribute('aria-pressed')).toBe('false');
    expect(pauseButton().disabled).toBe(false);
    expect(document.querySelector<HTMLElement>('#pause-error')?.hidden).toBe(false);
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(6000);
    expect(pauseButton().getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector<HTMLElement>('#pause-error')?.hidden).toBe(true);
  });

  it('cancels on mouse leave, requires a fresh click on return, and restarts the full delay', async () => {
    vi.useFakeTimers();
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(5999);
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    expect(pauseButton().textContent).toBe('Pause limits for 3 minutes');
    document.documentElement.dispatchEvent(new MouseEvent('mouseenter'));
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(5999);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(pauseButton().getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps counting down when moving between controls within the popup', async () => {
    vi.useFakeTimers();
    pauseButton().click();
    pauseButton().dispatchEvent(new MouseEvent('mouseleave'));
    document.querySelector('#pause-status')!.dispatchEvent(new MouseEvent('mouseenter'));
    await vi.advanceTimersByTimeAsync(6000);
    expect(pauseButton().getAttribute('aria-pressed')).toBe('true');
  });

  it.each(['blur', 'pagehide'])('cancels pending activation when the popup receives %s', async event => {
    vi.useFakeTimers();
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(5000);
    window.dispatchEvent(new Event(event));
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it('cancels pending activation when the popup becomes hidden', async () => {
    vi.useFakeTimers();
    pauseButton().click();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    hidden.mockRestore();
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it('allows canceling the countdown with a second click', async () => {
    vi.useFakeTimers();
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(3000);
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(pauseButton().textContent).toBe('Pause limits for 3 minutes');
  });

  it('keeps an activated pause when the mouse leaves the popup', async () => {
    vi.useFakeTimers();
    pauseButton().click();
    await vi.advanceTimersByTimeAsync(6000);
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    window.dispatchEvent(new Event('blur'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(pauseButton().getAttribute('aria-pressed')).toBe('true');
    expect(api.storage.local.set).toHaveBeenCalledOnce();
  });

  it('leaves the toggle disabled if its stored state cannot be loaded', async () => {
    api.storage.local.get.mockRejectedValueOnce(new Error('Storage unavailable'));
    await mountPopup();
    expect(pauseButton().disabled).toBe(true);
    expect(document.querySelector('#pause-error')?.textContent).toContain('Could not load');
  });
});
