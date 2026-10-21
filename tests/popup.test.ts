// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  storage: { local: { get: vi.fn(), set: vi.fn() } },
  tabs: { query: vi.fn(), reload: vi.fn() },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
const markup = readFileSync('entrypoints/popup/index.html', 'utf8');
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const input = () => document.querySelector<HTMLInputElement>('input')!;
const submit = async (value: string) => {
  input().value = value;
  document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await settle();
};
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  api.storage.local.get.mockResolvedValue({ postLimit: 42 });
  api.storage.local.set.mockResolvedValue(undefined);
  api.tabs.query.mockResolvedValue([{ id: 7, url: 'https://x.com/home' }]);
  api.tabs.reload.mockResolvedValue(undefined);
  document.body.innerHTML = markup.match(/<body>([\s\S]*)<\/body>/)![1]!;
  await import('../entrypoints/popup/main');
  await settle();
});
afterEach(() => { document.body.innerHTML = ''; });

describe('post limit popup', () => {
  it('loads the saved limit and saves before reloading the active X tab', async () => {
    expect(input().value).toBe('42');
    await submit('15');
    expect(api.storage.local.set).toHaveBeenCalledWith({ postLimit: 15 });
    expect(api.tabs.reload).toHaveBeenCalledWith(7);
    expect(api.storage.local.set.mock.invocationCallOrder[0]).toBeLessThan(api.tabs.reload.mock.invocationCallOrder[0]!);
  });
  it.each(['', '0', '1000', '1.5', '-4'])('does not save or reload invalid value %s', async value => {
    await submit(value);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(api.tabs.reload).not.toHaveBeenCalled();
  });
  it.each(['1', '999'])('accepts boundary value %s', async value => {
    await submit(value);
    expect(api.storage.local.set).toHaveBeenCalledWith({ postLimit: Number(value) });
    expect(api.tabs.reload).toHaveBeenCalledOnce();
  });
  it('saves without reloading an unrelated active page', async () => {
    api.tabs.query.mockResolvedValue([{ id: 7, url: 'https://example.com/' }]);
    await submit('80');
    expect(api.storage.local.set).toHaveBeenCalledWith({ postLimit: 80 });
    expect(api.tabs.reload).not.toHaveBeenCalled();
    expect(document.querySelector('#status')?.textContent).toContain('Limit saved');
  });
  it('does not reload if saving fails, and allows a retry', async () => {
    api.storage.local.set.mockRejectedValue(new Error('Storage unavailable'));
    await submit('20');
    expect(api.tabs.reload).not.toHaveBeenCalled();
    expect(document.querySelector('#status')?.textContent).toContain('Could not save');
    expect(input().disabled).toBe(false);
  });
});
