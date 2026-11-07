<img src="assets/logo.webp" width="96" height="128" alt="Unscrolled logo">

# Unscrolled

A Chrome extension that limits your X and Instagram Following feeds so you can stop scrolling and focus. Set a separate limit of **1 to 50 posts per day** for each feed (50 by default). Each feed has its own daily counter.

> you've seen 50 posts, it's time to focus now.

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

Click the extension icon to set separate whole-number limits from **1 to 50** for X and Instagram. Each limit saves when you leave its input. Saving reloads that feed when it is the active tab, and changing a limit preserves today's count. The feed's footer message and counter match that platform's limit.

Each setting persists across browser restarts and applies to future visits in all tabs for that platform. Other open feed tabs pick up limit changes automatically. If an older shared limit was saved, it is used for both platforms the first time, capped at 50, until each platform gets its own setting.

## How it works

The extension admits the first configured number of distinct post IDs in X's main column. Posts loaded ahead of your scroll position reserve a place in that allowance. Repeated posts count once; quoted posts belong to their containing post. After the limit, the remaining timeline cells are hidden and replaced with the focus footer. Previously admitted posts remain available when scrolling back.

The allowance is shared across tabs on the same platform and persists across reloads, new tabs, and browser restarts. X and Instagram have separate counters. Admitted post IDs are stored locally so repeats count once. Each counter resets every day at midnight in your computer's local timezone, including in open tabs. After sleep or a browser restart, the first use checks the date before granting posts. Changing a limit preserves that platform's usage for the day. Neither platform can show more than 50 counted posts per day.

A DOM observer handles dynamically loaded posts and recycled timeline cells. The footer lives outside the measured list in a clipped wrapper. Hidden rows keep their original dimensions, and the same footer stays mounted across feed updates, preventing layout feedback and scroll jitter. X may still fetch posts in the background; this extension hides them rather than intercepting network requests. It relies on X's current post markup (`primaryColumn`, `tweet`, `cellInnerDiv`, and timestamp permalinks), which may need updating if X changes its layout.

No account access, analytics, or remote services. A background service worker serializes admissions across tabs so concurrent updates cannot exceed each platform's daily limit. The `storage` permission stores the two limits and daily post IDs locally; `alarms` schedules the midnight reset; `activeTab` lets the popup identify and reload the active feed when you save. Instagram host access and `declarativeNetRequest` handle its redirects, and `webNavigation` catches in-app navigation to the home page. The content script runs only on X and Instagram pages.

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

The Following feed uses Instagram's separate daily limit (50 by default), with its own
counter independent of X. Distinct posts loaded into the feed reserve a place;
repeat posts count once. The counter persists across tabs and browser restarts,
resets at local midnight, and shows the stopping footer once the limit is reached.
Other Instagram pages are not limited. Detection relies on Instagram's `main article`
markup and post permalinks, so layout changes may require an update.

The extension now also requests Instagram host access and `declarativeNetRequest`
for page-load redirects. After rebuilding, reload the extension at
`chrome://extensions` and reload Instagram to enable the new content script.
