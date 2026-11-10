import logoUrl from '../assets/logo.webp?inline';

export const MESSAGE = "it's time to focus now.";
const BLOCKED = 'data-unscrolled-blocked';
const FOOTER = 'data-unscrolled-footer';
const WRAPPER = 'data-unscrolled-boundary';

interface Boundary {
  timeline: HTMLElement;
  wrapper: HTMLElement;
  footer: HTMLElement;
}

/** Keep feed virtualizer measurements intact; only clip its painted output. */
export function startLimiter(doc: Document, site: 'x' | 'instagram' = 'x'): () => void {
  const win = doc.defaultView!;
  const scope = site === 'instagram' ? 'main' : '[data-testid="primaryColumn"]';
  const containers = site === 'instagram'
    ? [':has(> article)']
    : [':has(> [data-testid="cellInnerDiv"] article[data-testid="tweet"])',
       ':not([data-testid="cellInnerDiv"]):has(> article[data-testid="tweet"])'];
  const selector = containers.map(container => `${scope}${container}, ${scope} ${container}`).join(', ');
  const boundaries = new Map<HTMLElement, Boundary>();
  const style = doc.createElement('style');
  style.textContent = `
    [${BLOCKED}], [${BLOCKED}] * { visibility: hidden !important; pointer-events: none !important; }
    [${BLOCKED}] { clip-path: inset(0px 0px 100% 0px) !important; }
    [${WRAPPER}] { display: block !important; position: relative !important;
      overflow: clip !important; overflow-anchor: none; flex-shrink: 0; min-width: 0; }
    [${FOOTER}] { position: absolute !important; inset-inline: 0 !important; top: 0 !important;
      box-sizing: border-box !important; display: block !important;
      margin: 0 !important; padding: 24px !important;
      text-align: center !important; z-index: 1; border-top: 1px solid #8884;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow-anchor: none; }
    [${FOOTER}] .unscrolled-panel { box-sizing: border-box; padding: 36px 24px;
      border: 0; background: inherit; }
    [${FOOTER}] .unscrolled-logo { display: block; width: 144px; height: 192px;
      max-width: 100%; object-fit: contain; margin: 0 auto 24px; }
    [${FOOTER}] h2 { margin: 0 0 18px; color: inherit; font: inherit;
      font-size: 28px; font-weight: 750; line-height: 1.15; letter-spacing: -.6px; }
    [${FOOTER}] p { max-width: 340px; margin: 0 auto; color: inherit; font-size: 20px;
      font-weight: 500; line-height: 1.5; overflow-wrap: anywhere; }`;
  let queued = false;
  let stopped = false;

  function footerBackground(element: Element): string {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = win.getComputedStyle(node).backgroundColor;
      if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
    }
    return win.matchMedia('(prefers-color-scheme: dark)').matches ? '#000' : '#fff';
  }

  function createBoundary(timeline: HTMLElement): Boundary {
    const wrapper = doc.createElement('div');
    wrapper.setAttribute(WRAPPER, '');
    // Never insert our footer among React's measured/recycled list children.
    timeline.before(wrapper);
    wrapper.append(timeline);
    timeline.setAttribute(BLOCKED, '');
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
    message.textContent = MESSAGE;
    panel.append(logo, heading, message);
    footer.append(panel);
    wrapper.append(footer);
    const state: Boundary = { timeline, wrapper, footer };
    boundaries.set(timeline, state);
    resizeObserver.observe(footer);
    updateBoundary(state);
    return state;
  }

  function updateBoundary(state: Boundary) {
    const { wrapper, footer } = state;
    // The list retains its full intrinsic height and every row retains its
    // dimensions. Only the outer wrapper sets the page's native scroll end.
    const height = `${footer.getBoundingClientRect().height}px`;
    if (wrapper.style.height !== height) wrapper.style.height = height;
  }

  function restore(state: Boundary) {
    resizeObserver.unobserve(state.footer);
    state.timeline.removeAttribute(BLOCKED);
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
    for (const timeline of doc.querySelectorAll<HTMLElement>(selector)) {
      if (!timeline.closest(`[${BLOCKED}]`)) createBoundary(timeline);
    }
    observer.observe(doc, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-testid'] });
  };
  const observer = new win.MutationObserver(records => {
    if (queued) return;
    if (records.every(record => record.target instanceof win.Element && record.target.closest(`[${BLOCKED}]`))) return;
    queued = true;
    queueMicrotask(() => { queued = false; scan(); });
  });
  const resizeObserver = new win.ResizeObserver(() => {
    if (!stopped) for (const state of boundaries.values()) updateBoundary(state);
  });
  scan();
  return () => {
    stopped = true;
    observer.disconnect();
    resizeObserver.disconnect();
    for (const state of boundaries.values()) restore(state);
    boundaries.clear();
    style.remove();
  };
}
