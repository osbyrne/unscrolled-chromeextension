<img src="assets/logo.webp" width="96" height="128" alt="Unscrolled logo">

# Unscrolled

A Chrome extension that limits your X feed so you can stop scrolling and focus. Choose **1 to 999 posts per day** (100 by default). At the default limit:

> you've seen a hundred posts, it's time to focus now.

## Install locally

Requires [Bun](https://bun.sh) 1.4.3 or newer.

```sh
bun install --frozen-lockfile
bun run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked**, then select `.output/chrome-mv3` from this project.
3. Open or reload X.com.

## Choose your limit

Click the extension icon, enter a whole number from **1 to 999**, then press **Enter** or click **Save & reload X**. The extension saves the limit locally and reloads the active X tab to apply the new cutoff without clearing today's count. The footer message and counter match your limit.

The setting persists across browser restarts and applies to future X visits in all tabs. Other open X tabs pick it up when reloaded. If you save from a different website, that page is left alone; open or reload X to apply the setting.

## How it works

The extension admits the first configured number of distinct post IDs in X's main column. Posts loaded ahead of your scroll position reserve a place in that allowance. Repeated posts count once; quoted posts belong to their containing post. After the limit, the remaining timeline cells are hidden and replaced with the focus footer. Previously admitted posts remain available when scrolling back.

The allowance is shared across X tabs and persists across reloads, new tabs, and browser restarts. Admitted post IDs are stored locally so repeats count once. The counter resets every day at midnight in your computer's local timezone, including in open X tabs. After sleep or a browser restart, the first use checks the date before granting posts. Changing the limit preserves today's usage.

A DOM observer handles dynamically loaded posts and recycled timeline cells. The footer lives outside the measured list in a clipped wrapper. Hidden rows keep their original dimensions, and the same footer stays mounted across feed updates, preventing layout feedback and scroll jitter. X may still fetch posts in the background; this extension hides them rather than intercepting network requests. It relies on X's current post markup (`primaryColumn`, `tweet`, `cellInnerDiv`, and timestamp permalinks), which may need updating if X changes its layout.

No account access, analytics, or remote services. A background service worker serializes admissions across tabs so concurrent updates cannot exceed the daily limit. The `storage` permission stores your chosen limit and daily post IDs locally; `alarms` schedules the midnight reset; `activeTab` lets the popup identify and reload the active X page when you save. The content script runs only on `https://x.com/*` and `https://www.x.com/*`.

## Development

```sh
bun run dev    # WXT development mode with Chrome
bun run check  # TypeScript
bun run test       # Feed boundary and dynamic DOM tests
bun run zip    # Packaged extension in .output/
```

The scripts run WXT, TypeScript, and Vitest with the Bun runtime. Use `bun run test` to run the Vitest suite. Commit `bun.lock` when dependencies change.

After a production rebuild, click Reload on the extension in `chrome://extensions`, then reload X.
