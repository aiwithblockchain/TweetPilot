# Electron Smoke Test

This is a local-first smoke test for the real Electron host.

## Run

```bash
npm run build
npm run test:electron-smoke
```

## What it checks

- The packaged Electron app starts and renders the dashboard.
- Navigation can move from `Dashboard` to `Accounts`.
- The preload bridge exposes `window.tweetOps`.
- `window.tweetOps.localBridge.getInstances()` completes with either data or a structured error.

## Notes

- This smoke test is intentionally **not** part of `npm run test:all`.
- It relies on a real Electron runtime and is intended for local verification before T5.
