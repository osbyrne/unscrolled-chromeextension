// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { MESSAGE, startLimiter } from '../utils/limiter';

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); document.body.innerHTML = ''; });
const post = (id: number) => `<div data-testid="cellInnerDiv"><article data-testid="tweet"><a href="/person/status/${id}"><time>now</time></a><p>Post ${id}</p></article></div>`;
const mount = (posts: string) => {
  document.body.innerHTML = `<main data-testid="primaryColumn"><div id="timeline">${posts}</div></main>`;
  return document.querySelector<HTMLElement>('#timeline')!;
};
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const visible = () => [...document.querySelectorAll('article')].filter(a => getComputedStyle(a).visibility !== 'hidden');

describe('blocked feed boundary', () => {
  it('blocks from the first post without changing the measured list children', () => {
    const timeline = mount(post(1) + post(2));
    const originalPosts = timeline.innerHTML;
    stop = startLimiter(document);
    expect(timeline.innerHTML).toBe(originalPosts);
    expect(visible()).toHaveLength(0);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
    expect(document.querySelector('footer p')?.textContent).toBe(MESSAGE);
    expect(document.querySelector('footer')?.textContent).not.toContain("you've seen");
    expect(timeline.querySelector('footer')).toBeNull();
    expect(timeline.nextElementSibling?.tagName).toBe('FOOTER');
    expect(timeline.children).toHaveLength(2);
    expect(getComputedStyle(document.querySelector('footer')!).top).toBe('0px');
  });

  it('blocks posts before their IDs or timestamp links appear', () => {
    mount('<div data-testid="cellInnerDiv"><article data-testid="tweet">Loading post</article></div>');
    stop = startLimiter(document);
    expect(visible()).toHaveLength(0);
    expect(document.querySelector('footer')).not.toBeNull();
  });

  it('blocks multiple feed containers without modifying their posts', () => {
    const first = mount(post(1));
    first.insertAdjacentHTML('afterend', `<div id="second">${post(2)}</div>`);
    stop = startLimiter(document);
    expect(visible()).toHaveLength(0);
    expect(document.querySelectorAll('footer')).toHaveLength(2);
    expect(first.innerHTML).toBe(post(1));
    expect(document.querySelector('#second')?.innerHTML).toBe(post(2));
  });

  it('blocks a feed directly in the primary column', () => {
    document.body.innerHTML = `<main data-testid="primaryColumn">${post(1)}</main>`;
    stop = startLimiter(document);
    expect(visible()).toHaveLength(0);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
  });

  it('blocks posts without a cell wrapper', () => {
    mount('<article data-testid="tweet">Post</article>');
    stop = startLimiter(document);
    expect(visible()).toHaveLength(0);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
  });

  it('blocks the first posts arriving after startup', async () => {
    const timeline = mount('');
    stop = startLimiter(document);
    timeline.innerHTML = post(1);
    await settle();
    expect(visible()).toHaveLength(0);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
  });

  it('keeps appended and recycled posts blocked', async () => {
    const timeline = mount(post(1));
    stop = startLimiter(document);
    timeline.innerHTML = post(2) + post(3);
    await settle();
    expect(visible()).toHaveLength(0);
    timeline.insertAdjacentHTML('beforeend', post(4));
    expect(visible()).toHaveLength(0);
    await settle();
    expect(visible()).toHaveLength(0);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
  });

  it('keeps the same footer and measured list on unrelated updates', async () => {
    const timeline = mount(post(1) + post(2));
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

  it('preserves and blocks a replacement timeline inside the wrapper', async () => {
    const timeline = mount(post(1));
    stop = startLimiter(document);
    timeline.outerHTML = `<div id="replacement">${post(2)}</div>`;
    await settle();
    expect(document.querySelector('#replacement')).not.toBeNull();
    expect(visible()).toHaveLength(0);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
  });

  it('ignores sidebar posts and restores the feed and original clipping on teardown', () => {
    const timeline = mount(post(1));
    timeline.style.setProperty('clip-path', 'inset(1px)', 'important');
    document.body.insertAdjacentHTML('beforeend', `<aside>${post(999)}</aside>`);
    stop = startLimiter(document);
    expect(getComputedStyle(document.querySelector('aside article')!).visibility).not.toBe('hidden');
    stop();
    expect(visible()).toHaveLength(2);
    expect(document.querySelector('footer')).toBeNull();
    expect(timeline.parentElement?.tagName).toBe('MAIN');
    expect(timeline.style.clipPath).toBe('inset(1px)');
    expect(timeline.style.getPropertyPriority('clip-path')).toBe('important');
  });
});
