import { browser } from 'wxt/browser';
import { LIMIT_PAUSE_DELAY, LIMIT_PAUSE_DURATION, LIMIT_PAUSE_KEY, readLimitPauseUntil } from '../../utils/limit-pause';
import './style.css';

function showStatus(status: HTMLElement, message: string) {
  status.textContent = message;
  status.hidden = message === '';
}

function setupPauseToggle(value: unknown) {
  const button = document.querySelector<HTMLButtonElement>('#pause-limits')!;
  const status = document.querySelector<HTMLElement>('#pause-status')!;
  const error = document.querySelector<HTMLElement>('#pause-error')!;
  let pausedUntil = readLimitPauseUntil(value);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let activateAt: number | undefined;
  let saving = false;
  let closed = false;

  function render() {
    clearTimeout(timer);
    if (closed) return;
    if (activateAt !== undefined) {
      const seconds = Math.max(0, Math.ceil((activateAt - Date.now()) / 1000));
      if (seconds === 0) {
        activateAt = undefined;
        void savePause(Date.now() + LIMIT_PAUSE_DURATION);
        return;
      }
      button.setAttribute('aria-pressed', 'false');
      button.textContent = `Cancel pause (${seconds}s)`;
      status.textContent = `Keep the mouse inside this window. Pause starts in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`;
      timer = setTimeout(render, Math.min(1000, activateAt - Date.now()));
      return;
    }
    const remaining = Math.max(0, Math.ceil((pausedUntil - Date.now()) / 1000));
    button.setAttribute('aria-pressed', String(remaining > 0));
    button.textContent = remaining > 0 ? 'Resume limits now' : 'Pause limits for 3 minutes';
    status.textContent = remaining > 0
      ? `Limits paused for ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} on X and Instagram.`
      : 'Applies to X and Instagram.';
    if (remaining > 0) timer = setTimeout(render, Math.min(1000, pausedUntil - Date.now()));
  }

  async function savePause(nextPauseUntil: number) {
    saving = true;
    button.disabled = true;
    showStatus(error, '');
    try {
      await browser.storage.local.set({ [LIMIT_PAUSE_KEY]: nextPauseUntil });
      pausedUntil = nextPauseUntil;
    } catch {
      showStatus(error, 'Could not change the pause. Please try again.');
    } finally {
      saving = false;
      button.disabled = false;
      render();
    }
  }

  function cancelPending() {
    if (activateAt === undefined) return;
    activateAt = undefined;
    render();
  }

  button.disabled = false;
  render();
  button.addEventListener('click', () => {
    if (saving || closed) return;
    if (pausedUntil > Date.now()) {
      void savePause(0);
    } else if (activateAt !== undefined) {
      cancelPending();
    } else {
      showStatus(error, '');
      activateAt = Date.now() + LIMIT_PAUSE_DELAY;
      render();
    }
  });

  const onStorage = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'local' || !changes[LIMIT_PAUSE_KEY]) return;
    activateAt = undefined;
    pausedUntil = readLimitPauseUntil(changes[LIMIT_PAUSE_KEY].newValue);
    render();
  };
  const onVisibility = () => { if (document.hidden) cancelPending(); };
  document.documentElement.addEventListener('mouseleave', cancelPending);
  window.addEventListener('blur', cancelPending);
  document.addEventListener('visibilitychange', onVisibility);
  browser.storage.onChanged.addListener(onStorage);
  window.addEventListener('pagehide', () => {
    closed = true;
    activateAt = undefined;
    clearTimeout(timer);
    document.documentElement.removeEventListener('mouseleave', cancelPending);
    window.removeEventListener('blur', cancelPending);
    document.removeEventListener('visibilitychange', onVisibility);
    browser.storage.onChanged.removeListener(onStorage);
  }, { once: true });
}

async function load() {
  try {
    const settings = await browser.storage.local.get(LIMIT_PAUSE_KEY);
    setupPauseToggle(settings[LIMIT_PAUSE_KEY]);
  } catch {
    showStatus(document.querySelector<HTMLElement>('#pause-error')!, 'Could not load the pause. Reopen the popup to try again.');
  }
}

void load();
