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
const input = (site: 'x' | 'instagram' = 'x') => document.querySelector<HTMLInputElement>(`form[data-site="${site}"] input`)!;
const status = (site: 'x' | 'instagram' = 'x') => document.querySelector<HTMLElement>(`form[data-site="${site}"] [role="status"]`)!;
const leaveInput = async (value: string, site: 'x' | 'instagram' = 'x') => {
  input(site).focus();
  input(site).value = value;
  input(site).blur();
  await settle();
};
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  api.storage.local.get.mockResolvedValue({ xPostLimit: 42 });
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
    await leaveInput('15');
    expect(api.storage.local.set).toHaveBeenCalledWith({ xPostLimit: 15 });
    expect(api.tabs.reload).toHaveBeenCalledWith(7);
    expect(api.storage.local.set.mock.invocationCallOrder[0]).toBeLessThan(api.tabs.reload.mock.invocationCallOrder[0]!);
  });
  it.each(['', '0', '51', '1.5', '-4'])('does not save or reload invalid value %s', async value => {
    await leaveInput(value);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(api.tabs.reload).not.toHaveBeenCalled();
  });
  it.each(['1', '50'])('accepts boundary value %s', async value => {
    await leaveInput(value);
    expect(api.storage.local.set).toHaveBeenCalledWith({ xPostLimit: Number(value) });
    expect(api.tabs.reload).toHaveBeenCalledOnce();
  });
  it('saves without reloading an unrelated active page', async () => {
    api.tabs.query.mockResolvedValue([{ id: 7, url: 'https://example.com/' }]);
    await leaveInput('30');
    expect(api.storage.local.set).toHaveBeenCalledWith({ xPostLimit: 30 });
    expect(api.tabs.reload).not.toHaveBeenCalled();
    expect(status().hidden).toBe(true);
  });
  it('does not reload if saving fails, and allows a retry', async () => {
    api.storage.local.set.mockRejectedValueOnce(new Error('Storage unavailable'));
    await leaveInput('20');
    expect(api.tabs.reload).not.toHaveBeenCalled();
    expect(status().textContent).toContain('Could not save');
    expect(status().hidden).toBe(false);
    expect(input().disabled).toBe(false);
    await leaveInput('20');
    expect(api.storage.local.set).toHaveBeenLastCalledWith({ xPostLimit: 20 });
    expect(api.tabs.reload).toHaveBeenCalledWith(7);
    expect(status().hidden).toBe(true);
  });
  it('shows only the controls, hints, and requested footer during normal use', async () => {
    expect(document.querySelector('header')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('button')).toBeNull();
    expect(document.querySelector('.intro')).toBeNull();
    expect(document.querySelector('footer')?.textContent).toBe('limits saved. resets at midnight');
    await leaveInput('25');
    expect(status().hidden).toBe(true);
    expect(status('instagram').hidden).toBe(true);
    expect(status().textContent).toBe('');
  });
  it('waits for focus to leave the input before saving', async () => {
    input().focus();
    input().value = '25';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(api.storage.local.set).not.toHaveBeenCalled();
    input('instagram').focus();
    await settle();
    expect(api.storage.local.set).toHaveBeenCalledWith({ xPostLimit: 25 });
    expect(document.activeElement).toBe(input('instagram'));
  });
  it('does not save or reload when an unchanged input loses focus', async () => {
    await leaveInput('42');
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(api.tabs.reload).not.toHaveBeenCalled();
  });
  it('saves the Instagram limit independently when its input loses focus', async () => {
    api.tabs.query.mockResolvedValue([{ id: 8, url: 'https://www.instagram.com/?variant=following' }]);
    await leaveInput('25', 'instagram');
    expect(api.storage.local.set).toHaveBeenCalledExactlyOnceWith({ instagramPostLimit: 25 });
    expect(input().value).toBe('42');
    expect(api.tabs.reload).toHaveBeenCalledWith(8);
    expect(status('instagram').hidden).toBe(true);
  });
  it('saves an Instagram change without reloading the active X tab', async () => {
    await leaveInput('25', 'instagram');
    expect(api.storage.local.set).toHaveBeenCalledWith({ instagramPostLimit: 25 });
    expect(api.tabs.reload).not.toHaveBeenCalled();
  });
  it('shows a reload error after a successful save', async () => {
    api.tabs.reload.mockRejectedValueOnce(new Error('Tab unavailable'));
    await leaveInput('25');
    expect(api.storage.local.set).toHaveBeenCalledWith({ xPostLimit: 25 });
    expect(status().hidden).toBe(false);
    expect(status().textContent).toContain('Reload the feed');
    expect(input().disabled).toBe(false);
  });
});
