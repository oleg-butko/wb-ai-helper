# React + Vite + CRXJS

This template helps you quickly start developing Chrome extensions with React, TypeScript and Vite. It includes the CRXJS Vite plugin for seamless Chrome extension development.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

4. Build explicit extension variants:

```bash
npm run build:production
npm run build:develop
```

The production build stores this default config in `chrome.storage.sync` on first install or manual reset:

- `API_BASE_URL`: `""` unless `VITE_EXTENSION_API_BASE_URL` is provided
- `API_KEY`: `""`
- `user_id`: generated UUIDv7

The develop build stores this default config:

- `API_BASE_URL`: `http://localhost:8181` unless `VITE_EXTENSION_API_BASE_URL` is provided
- `API_KEY`: `""`
- `user_id`: generated UUIDv7
- `is_dev_mode`: `true`

To reset the installed extension config manually, open the service worker DevTools console and run:

```js
await self.resetConfig()
```

## Project Structure

- `src/popup/` - Extension popup UI
- `src/content/` - Content scripts
- `src/background/` - Extension service worker
- `src/config/` - Extension config defaults and storage helpers
- `manifest.config.ts` - Chrome extension manifest configuration
