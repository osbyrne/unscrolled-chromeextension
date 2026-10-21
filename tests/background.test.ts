import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  storage: { local: { get: vi.fn(), set: vi.fn() } },
  runtime: { onMessage: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() }, onInstalled: { addListener: vi.fn() } },
  alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
vi.mock('wxt/utils/define-background', () => ({ defineBackground: (main: () => void) => main }));
let saved: Record<string, unknown>;
let handle: (message: unknown, sender: unknown, respond: (value: { ids: string[] }) => void) => unknown;
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  saved = { postLimit: 3 };
  api.storage.local.get.mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 1));
    return structuredClone(saved);
  });
  api.storage.local.set.mockImplementation(async value => { Object.assign(saved, value); });
  const { default: main } = await import('../entrypoints/background');
  (main as unknown as () => void)();
  handle = api.runtime.onMessage.addListener.mock.calls[0]![0];
});
const admit = (ids: string[]) => new Promise<{ ids: string[] }>(resolve => {
  handle({ type: 'unscrolled:admit', ids }, { url: 'https://x.com/home' }, resolve);
});
describe('shared counter writer', () => {
  it('clears an expired allowance when the midnight alarm runs', async () => {
    saved.dailyCounter = { day: '2000-01-01', ids: ['1', '2', '3'] };
    const alarm = api.alarms.onAlarm.addListener.mock.calls[0]![0];
    alarm({ name: 'daily-reset' });
    await new Promise(resolve => setTimeout(resolve, 15));
    expect(saved.dailyCounter).toEqual({ day: expect.any(String), ids: [] });
    expect(await admit(['4'])).toEqual({ ids: ['4'] });
  });

  it('serializes concurrent tabs so they cannot exceed the daily limit', async () => {
    const [first, second] = await Promise.all([admit(['1', '2']), admit(['3', '4'])]);
    expect(first.ids).toEqual(['1', '2']);
    expect(second.ids).toEqual(['1', '2', '3']);
    expect(await admit(['4', '5'])).toEqual({ ids: ['1', '2', '3'] });
    expect(api.alarms.create).toHaveBeenCalledWith('daily-reset', expect.objectContaining({ when: expect.any(Number) }));
  });
  it('retains the counter after the service worker restarts', async () => {
    await admit(['1', '2']);
    const { default: main } = await import('../entrypoints/background');
    (main as unknown as () => void)();
    handle = api.runtime.onMessage.addListener.mock.calls.at(-1)![0];
    expect(await admit(['2', '3', '4'])).toEqual({ ids: ['1', '2', '3'] });
  });
});
