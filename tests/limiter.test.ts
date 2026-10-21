// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { MESSAGE, startLimiter } from '../utils/limiter';

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); document.body.innerHTML = ''; });
const post = (id: number) => `<div data-testid="cellInnerDiv"><article data-testid="tweet"><a href="/person/status/${id}"><time>now</time></a><p>Post ${id}</p></article></div>`;
const mount = (posts: string) => {
  document.body.innerHTML = `<main data-testid="primaryColumn"><div id="timeline">${posts}</div></main>`;
  return document.querySelector('#timeline')!;
};
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
const visible = () => [...document.querySelectorAll('article')].filter(a => !a.closest('[data-unscrolled-hidden]'));

describe('post limit feed boundary', () => {
  it.each([1, 15, 999])('places the footer after a custom limit of %s posts', limit => {
    mount(Array.from({length: limit + 2}, (_, i) => post(i + 1)).join(''));
    stop = startLimiter(document, limit);
    expect(visible()).toHaveLength(limit);
    expect(document.querySelector('footer p')?.textContent).toBe(
      `you've seen ${limit} ${limit === 1 ? 'post' : 'posts'}, it's time to focus now.`,
    );
    expect(document.querySelector('footer small')?.textContent).toBe(`Unscrolled · ${limit} / ${limit}`);
  });

  it('preserves exactly 100 posts and replaces the remaining cells with one footer', () => {
    const timeline = mount(Array.from({length: 110}, (_, i) => post(i + 1)).join(''));
    stop = startLimiter(document);
    expect(visible()).toHaveLength(100);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
    expect(document.querySelector('footer p')?.textContent).toBe(MESSAGE);
    expect(timeline.querySelector('footer')).toBeNull();
    expect(timeline.nextElementSibling?.tagName).toBe('FOOTER');
    expect(timeline.children).toHaveLength(110);
  });

  it('remembers removed posts, allows duplicates, and blocks newly appended posts', async () => {
    const timeline = mount(Array.from({length: 100}, (_, i) => post(i + 1)).join(''));
    stop = startLimiter(document);
    timeline.innerHTML = post(99) + post(100) + post(101);
    await settle();
    expect(visible()).toHaveLength(2);
    timeline.insertAdjacentHTML('beforeend', post(102));
    await settle();
    expect(visible()).toHaveLength(2);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
  });

  it('handles SPA timeline replacement and recycled cell identities', async () => {
    const timeline = mount(Array.from({length: 100}, (_, i) => post(i + 1)).join(''));
    stop = startLimiter(document);
    timeline.outerHTML = `<div id="timeline">${post(100)}${post(101)}</div>`;
    await settle();
    expect(visible()).toHaveLength(1);
    document.querySelector('a')!.setAttribute('href', '/person/status/102');
    await settle();
    expect(visible()).toHaveLength(0);
  });

  it('keeps the same footer and does not mutate the measured list on unrelated updates', async () => {
    const timeline = mount(Array.from({length: 105}, (_, i) => post(i + 1)).join(''));
    stop = startLimiter(document);
    const footer = document.querySelector('footer');
    const changes: MutationRecord[] = [];
    const observer = new MutationObserver(records => changes.push(...records));
    observer.observe(timeline, { subtree: true, childList: true, attributes: true });
    document.body.insertAdjacentHTML('beforeend', '<aside>A live notification</aside>');
    await settle();
    expect(document.querySelector('footer')).toBe(footer);
    expect(changes).toHaveLength(0);
    observer.disconnect();
  });

  it('preserves a replacement timeline in the wrapper', async () => {
    const timeline = mount(Array.from({length: 101}, (_, i) => post(i + 1)).join(''));
    stop = startLimiter(document);
    timeline.outerHTML = `<div id="replacement">${post(102)}</div>`;
    await settle();
    expect(document.querySelector('#replacement')).not.toBeNull();
    expect(visible()).toHaveLength(0);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
  });

  it('ignores sidebar posts and restores hidden content on teardown', () => {
    mount(Array.from({length: 101}, (_, i) => post(i + 1)).join(''));
    document.body.insertAdjacentHTML('beforeend', `<aside>${post(999)}</aside>`);
    stop = startLimiter(document);
    expect(document.querySelector('aside [data-unscrolled-hidden]')).toBeNull();
    stop();
    expect(document.querySelector('[data-unscrolled-hidden]')).toBeNull();
    expect(document.querySelector('footer')).toBeNull();
  });
});
