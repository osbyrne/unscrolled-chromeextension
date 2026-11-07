import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Unscrolled — scroll less, focus more',
    permissions: ['storage', 'activeTab', 'alarms', 'declarativeNetRequest', 'webNavigation'],
    host_permissions: ['*://instagram.com/*', '*://www.instagram.com/*'],
    declarative_net_request: { rule_resources: [{ id: 'instagram', enabled: true, path: 'rules/instagram.json' }] },
    description: 'A natural stopping point for X and Instagram. Set separate limits of up to 50 posts per day for each feed.',
    version: '1.0.0',
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: { default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' } },
  },
});
