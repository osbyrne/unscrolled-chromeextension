<img src="assets/logo.webp" width="96" height="128" alt="Unscrolled logo">

# Unscrolled

A Chrome extension that blocks posts in X's main column and Instagram's Following feed from the first post. Use a deliberate three-minute pause when you need feed access.

> it's time to focus now.

## Install locally

Requires [Bun](https://bun.sh) 1.4.3 or newer.

```sh
bun install --frozen-lockfile
bun run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked**, then select `.output/chrome-mv3` from this project.
3. Open or reload X.com.

## Pause blocking

Click **Pause limits for 3 minutes** in the popup, then keep the mouse inside the popup for six seconds. Leaving the popup or closing it during the countdown cancels activation. You can also click **Cancel pause** during the countdown.

After activation, posts become available in all open X and Instagram Following tabs. The popup shows the time remaining. Click **Resume limits now** to block posts again immediately. Blocking resumes automatically after three minutes, even if you close the popup, reload a feed, or restart the browser. Instagram's redirects remain active.

## How it works

The extension marks each feed container as blocked. CSS hides its contents, including newly loaded posts, and a focus message appears beside the container. A DOM observer discovers new or replacement feed containers and ignores updates inside feeds that are already blocked. The footer lives outside the measured list in a clipped wrapper, preserving row dimensions and keeping the message stable across feed updates.

Feeds stay blocked while the saved pause is loading or if storage cannot be read. They open only after the extension confirms an active pause.

X may still fetch posts in the background. The extension hides them rather than intercepting network requests. It relies on X's current post markup (`primaryColumn`, `tweet`, and `cellInnerDiv`), which may need updating if X changes its layout. X's post history at `/i/history` remains accessible.

No account access, analytics, or remote services. The `storage` permission keeps the pause expiry locally and shares it across tabs. Instagram host access and `declarativeNetRequest` handle its redirects, and `webNavigation` catches in-app navigation to the home page. The content script runs only on X and Instagram pages.

## Development

```sh
bun run dev    # WXT development mode with Chrome
bun run check  # TypeScript
bun run test       # Feed boundary and dynamic DOM tests
bun run zip    # Packaged extension in .output/
```

The scripts run WXT, TypeScript, and Vitest with the Bun runtime. Use `bun run test` to run the Vitest suite. Commit `bun.lock` when dependencies change.

After a production rebuild, click Reload on the extension in `chrome://extensions`, then reload X.

## Instagram

Instagram's home page redirects to `https://www.instagram.com/?variant=following`.
`/reels/` and its subpaths redirect to `https://www.instagram.com/direct/`.
Direct, profiles, individual posts, and other URLs remain accessible. Redirects also
apply during Instagram's in-app navigation.

The Following feed blocks every post by default and shares the three-minute pause with X.
Other Instagram pages are not blocked. Detection relies on Instagram's `main article`
markup, so layout changes may require an update.
