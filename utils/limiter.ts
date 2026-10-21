import { DEFAULT_POST_LIMIT, footerMessage } from './settings';
import logoUrl from '../assets/logo.webp?inline';

export const POST_LIMIT = DEFAULT_POST_LIMIT;
export const MESSAGE = "you've seen a hundred posts, it's time to focus now.";
const HIDDEN = 'data-unscrolled-hidden';
const FOOTER = 'data-unscrolled-footer';
const WRAPPER = 'data-unscrolled-boundary';

interface Boundary {
  timeline: HTMLElement;
  wrapper: HTMLElement;
  footer: HTMLElement;
  cutoff: number;
  anchor: HTMLElement;
  anchorHref: string | null;
  appliedClip: string;
  clipCutoff: number;
  originalClip: string;
  originalClipPriority: string;
}

/** Keep X's virtualizer measurements intact; only clip its painted output. */
export function startLimiter(doc: Document, limit = POST_LIMIT): () => void {
  const win = doc.defaultView!;
  const admitted = new Set<string>();
  const boundaries = new Map<HTMLElement, Boundary>();
  const style = doc.createElement('style');
  style.textContent = `
    [${HIDDEN}] { visibility: hidden !important; pointer-events: none !important; }
    [${WRAPPER}] { display: block !important; position: relative !important;
      overflow: clip !important; overflow-anchor: none; flex-shrink: 0; min-width: 0; }
    [${FOOTER}] { position: absolute !important; inset-inline: 0 !important;
      box-sizing: border-box !important; display: block !important;
      margin: 0 !important; padding: 24px !important;
      text-align: center !important; z-index: 1; border-top: 1px solid #8884;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow-anchor: none; }
    [${FOOTER}] .unscrolled-panel { box-sizing: border-box; padding: 36px 24px;
      border: 2px solid currentColor; border-radius: 0; background: inherit; }
    [${FOOTER}] .unscrolled-logo { display: block; width: 144px; height: 192px;
      max-width: 100%; object-fit: contain; margin: 0 auto 24px; }
    [${FOOTER}] h2 { margin: 0 0 18px; color: inherit; font: inherit;
      font-size: 28px; font-weight: 750; line-height: 1.15; letter-spacing: -.6px; }
    [${FOOTER}] p { max-width: 340px; margin: 0 auto; color: inherit; font-size: 20px;
      font-weight: 500; line-height: 1.5; overflow-wrap: anywhere; }
    [${FOOTER}] small { display: block; margin-top: 24px; font-size: 12px;
      opacity: .75; letter-spacing: 1.5px; }`;
  let queued = false;
  let stopped = false;

  function footerBackground(element: Element): string {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = win.getComputedStyle(node).backgroundColor;
      if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
    }
    return win.matchMedia('(prefers-color-scheme: dark)').matches ? '#000' : '#fff';
  }

  function createBoundary(timeline: HTMLElement, anchor: HTMLElement): Boundary {
    const wrapper = doc.createElement('div');
    wrapper.setAttribute(WRAPPER, '');
    // Never insert our footer among React's measured/recycled list children.
    timeline.before(wrapper);
    wrapper.append(timeline);
    const footer = doc.createElement('footer');
    footer.setAttribute(FOOTER, '');
    footer.setAttribute('role', 'status');
    footer.style.backgroundColor = footerBackground(timeline);
    footer.style.color = win.getComputedStyle(timeline).color;
    const panel = doc.createElement('div');
    panel.className = 'unscrolled-panel';
    const logo = doc.createElement('img');
    logo.className = 'unscrolled-logo';
    logo.src = logoUrl;
    logo.alt = 'Unscrolled';
    logo.width = 144;
    logo.height = 192;
    const heading = doc.createElement('h2');
    heading.textContent = 'End of scrolling.';
    const message = doc.createElement('p');
    message.textContent = footerMessage(limit);
    const label = doc.createElement('small');
    label.textContent = `Unscrolled · ${limit} / ${limit}`;
    panel.append(logo, heading, message, label);
    footer.append(panel);
    wrapper.append(footer);
    const state: Boundary = {
      timeline, wrapper, footer, anchor, cutoff: 0,
      anchorHref: anchor.querySelector('time')?.closest('a')?.getAttribute('href') ?? null,
      appliedClip: '', clipCutoff: -1,
      originalClip: timeline.style.getPropertyValue('clip-path'),
      originalClipPriority: timeline.style.getPropertyPriority('clip-path'),
    };
    boundaries.set(timeline, state);
    resizeObserver.observe(footer);
    resizeObserver.observe(timeline);
    updateBoundary(state, true);
    return state;
  }

  function updateBoundary(state: Boundary, measure = false) {
    const { timeline, wrapper, footer, anchor } = state;
    // Pin the cutoff when the first rejected row is recycled. Later rows must
    // never move the footer further down and reopen the scrolling allowance.
    if (measure && anchor.isConnected && anchor.parentElement === timeline &&
      anchor.querySelector('time')?.closest('a')?.getAttribute('href') === state.anchorHref) {
      state.cutoff = Math.max(0, anchor.getBoundingClientRect().top - timeline.getBoundingClientRect().top);
    }
    const cutoff = `${state.cutoff}px`;
    const clip = `inset(0px 0px max(0px, calc(100% - ${cutoff})) 0px)`;
    if (state.clipCutoff !== state.cutoff || timeline.style.clipPath !== state.appliedClip) {
      timeline.style.setProperty('clip-path', clip, 'important');
      // Browsers normalize calc()/inset() strings; compare the serialized value.
      state.appliedClip = timeline.style.clipPath;
      state.clipCutoff = state.cutoff;
    }
    if (footer.style.top !== cutoff) footer.style.top = cutoff;
    // The list retains its full intrinsic height and every row retains its
    // dimensions. Only the outer wrapper sets the page's native scroll end.
    const height = `${state.cutoff + footer.getBoundingClientRect().height}px`;
    if (wrapper.style.height !== height) wrapper.style.height = height;
  }

  function restore(state: Boundary) {
    resizeObserver.unobserve(state.footer);
    resizeObserver.unobserve(state.timeline);
    state.timeline.style.setProperty('clip-path', state.originalClip, state.originalClipPriority);
    state.footer.remove();
    state.wrapper.replaceWith(...state.wrapper.childNodes);
  }

  const scan = () => {
    if (stopped) return;
    observer.disconnect();
    if (!style.isConnected) (doc.head ?? doc.documentElement)?.append(style);
    for (const [timeline, state] of boundaries) {
      if (!timeline.isConnected) { restore(state); boundaries.delete(timeline); }
    }
    const rejected = new Map<HTMLElement, HTMLElement>();
    const hidden = new Set<Element>();
    const articles = doc.querySelectorAll<HTMLElement>(
      '[data-testid="primaryColumn"] article[data-testid="tweet"]',
    );
    for (const article of articles) {
      const href = article.querySelector('time')?.closest('a')?.getAttribute('href');
      const id = href?.match(/\/status\/(\d+)/)?.[1];
      if (!id) continue;
      const cell = article.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? article;
      const timeline = cell.parentElement;
      if (!timeline) continue;
      if (!admitted.has(id) && admitted.size < limit) admitted.add(id);
      if (!admitted.has(id)) {
        hidden.add(cell);
        if (!rejected.has(timeline)) rejected.set(timeline, cell);
      }
    }
    // Diff attributes instead of unhiding and rehiding all rows on every scan.
    for (const node of doc.querySelectorAll(`[${HIDDEN}]`)) {
      if (!hidden.has(node)) node.removeAttribute(HIDDEN);
    }
    for (const node of hidden) if (!node.hasAttribute(HIDDEN)) node.setAttribute(HIDDEN, '');
    for (const [timeline, anchor] of rejected) {
      if (!boundaries.has(timeline)) createBoundary(timeline, anchor);
    }
    for (const state of boundaries.values()) updateBoundary(state);
    observer.observe(doc, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['href', 'data-testid'] });
  };
  const observer = new win.MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; scan(); });
  });
  const resizeObserver = new win.ResizeObserver(() => {
    if (!stopped) for (const state of boundaries.values()) updateBoundary(state, true);
  });
  scan();
  return () => {
    stopped = true;
    observer.disconnect();
    resizeObserver.disconnect();
    for (const state of boundaries.values()) restore(state);
    boundaries.clear();
    style.remove();
    for (const node of doc.querySelectorAll(`[${HIDDEN}]`)) node.removeAttribute(HIDDEN);
  };
}
