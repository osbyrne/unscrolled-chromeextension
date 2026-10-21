import { browser } from 'wxt/browser';
import { isPostLimit, isXPage, LIMIT_STORAGE_KEY, readPostLimit } from '../../utils/settings';
import './style.css';

const form = document.querySelector<HTMLFormElement>('#limit-form')!;
const input = document.querySelector<HTMLInputElement>('#post-limit')!;
const button = document.querySelector<HTMLButtonElement>('button')!;
const status = document.querySelector<HTMLElement>('#status')!;
let saving = false;

function showStatus(message: string, error = false) {
  status.textContent = message;
  status.toggleAttribute('data-error', error);
}

async function load() {
  try {
    const settings = await browser.storage.local.get(LIMIT_STORAGE_KEY);
    input.value = String(readPostLimit(settings[LIMIT_STORAGE_KEY]));
    input.disabled = false;
    button.disabled = false;
    showStatus('Press Enter or save to apply your limit.');
  } catch {
    showStatus('Could not load your setting. Reopen the popup to try again.', true);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (saving || !form.reportValidity() || !isPostLimit(input.valueAsNumber)) return;
  saving = true;
  button.disabled = true;
  input.disabled = true;
  try {
    await browser.storage.local.set({ [LIMIT_STORAGE_KEY]: input.valueAsNumber });
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined && isXPage(tab.url)) {
      try {
        await browser.tabs.reload(tab.id);
        showStatus('Saved. X is reloading with your new limit.');
      } catch {
        showStatus('Limit saved. Reload X to apply it.', true);
      }
    } else {
      showStatus('Limit saved. Open or reload X to apply it.');
    }
  } catch {
    showStatus('Could not save your limit. Please try again.', true);
  } finally {
    saving = false;
    button.disabled = false;
    input.disabled = false;
  }
});

void load();
