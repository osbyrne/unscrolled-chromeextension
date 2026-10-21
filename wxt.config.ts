import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Unscrolled — scroll less, focus more',
    permissions: ['storage', 'activeTab'],
    description: 'A natural stopping point for X. Choose a limit from 1 to 999 posts per visit, then get back to what matters.',
    version: '1.0.0',
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: { default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' } },
  },
});
