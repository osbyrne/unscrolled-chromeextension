import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Unscrolled — scroll less, focus more',
    permissions: ['storage', 'declarativeNetRequest', 'webNavigation'],
    host_permissions: ['*://instagram.com/*', '*://www.instagram.com/*'],
    declarative_net_request: { rule_resources: [{ id: 'instagram', enabled: true, path: 'rules/instagram.json' }] },
    description: 'Block X and Instagram feeds by default, with a deliberate three-minute pause when you need it.',
    version: '1.0.0',
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: { default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' } },
  },
});
