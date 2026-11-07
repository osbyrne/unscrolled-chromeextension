import { browser } from 'wxt/browser';
import { isPostLimit, isXPage, readPostLimit, X_LIMIT_STORAGE_KEY, INSTAGRAM_LIMIT_STORAGE_KEY, LEGACY_LIMIT_STORAGE_KEY } from '../../utils/settings';
import { isInstagramFollowing } from '../../utils/instagram';
import './style.css';

const sites = [
  { id: 'x', key: X_LIMIT_STORAGE_KEY, matches: isXPage },
  { id: 'instagram', key: INSTAGRAM_LIMIT_STORAGE_KEY, matches: isInstagramFollowing },
];

function showStatus(status: HTMLElement, message: string) {
  status.textContent = message;
  status.hidden = message === '';
}

async function load() {
  try {
    const settings = await browser.storage.local.get([
      X_LIMIT_STORAGE_KEY, INSTAGRAM_LIMIT_STORAGE_KEY, LEGACY_LIMIT_STORAGE_KEY,
    ]);
    for (const site of sites) {
      const form = document.querySelector<HTMLFormElement>(`form[data-site="${site.id}"]`)!;
      const input = form.querySelector<HTMLInputElement>('input')!;
      const status = form.querySelector<HTMLElement>('[role="status"]')!;
      let savedLimit = readPostLimit(settings[site.key], settings[LEGACY_LIMIT_STORAGE_KEY]);
      let saving = false;
      input.value = String(savedLimit);
      input.disabled = false;

      form.addEventListener('submit', event => {
        event.preventDefault();
        input.blur();
      });

      input.addEventListener('blur', async () => {
        const limit = input.valueAsNumber;
        if (saving || !input.reportValidity() || !isPostLimit(limit) || limit === savedLimit) return;
        saving = true;
        input.disabled = true;
        showStatus(status, '');
        try {
          await browser.storage.local.set({ [site.key]: limit });
          savedLimit = limit;
        } catch {
          showStatus(status, 'Could not save this limit. Please try again.');
          return;
        } finally {
          saving = false;
          input.disabled = false;
        }

        try {
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
          if (tab?.id !== undefined && site.matches(tab.url)) {
            await browser.tabs.reload(tab.id);
          }
        } catch {
          showStatus(status, 'Limit saved. Reload the feed to apply it.');
        }
      });
    }
  } catch {
    for (const form of document.querySelectorAll<HTMLFormElement>('form[data-site]')) {
      showStatus(form.querySelector<HTMLElement>('[role="status"]')!, 'Could not load this setting. Reopen the popup to try again.');
    }
  }
}

void load();
