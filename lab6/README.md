# AniLog Terminal

AniLog Terminal is a client-side React app for browsing anime and manga through a public API and saving titles into a local terminal-style vault. Everything runs in the browser only.

## Topic

- Anime and manga discovery + personal vault
- Data source: Jikan public API
- Visual style: minimalist terminal/code workspace with dark, light, and grayscale variants

## Main Flows

1. Open the app and load public discovery feeds.
2. Browse current seasonal anime and top ranked manga.
3. Search the catalog for specific anime or manga titles.
4. Save interesting titles into the local vault.
5. Like, remove, and filter saved entries by type, source, and search text.
6. Reopen the app later and continue from persisted browser storage.

## Lab Requirements Coverage

- Entities that can be manipulated:
  - anime titles
  - manga titles
  - actions: save, remove, like, filter
- Custom theme/style:
  - monochrome terminal-inspired layout
  - dark and light theme switch
- Public hosting:
  - configured for GitHub Pages under `/web-repo/lab6/`
- Front-end framework:
  - React
- Runtime state:
  - in-memory React state for views, filters, discovery data, search data, and saved entries
- Browser persistence:
  - `localStorage` for theme and local vault
- Git history:
  - built as a sequence of focused commits

## Features

- Seasonal anime feed from a public API
- Top manga ranking feed from a public API
- Public catalog search for anime and manga
- Local vault with add/remove/like actions
- Vault filters by title text, type, source, and liked state
- Responsive layout for desktop and mobile
- Dark/light terminal theme

## Views

### `discover`

- Loads seasonal anime and top manga from public endpoints
- Lets the user save or remove entries from the local vault

### `search`

- Searches anime or manga by title
- Lets the user save or remove results from the local vault

### `library`

- Shows all locally stored entries
- Supports filtering by:
  - text query
  - kind (`anime` / `manga`)
  - source (`seasonal`, `ranking`, `search`)
  - liked only toggle

### `source`

- Documents the public data mode used by the app
- Confirms that all saved user state remains local in the browser

## Tech Stack

- React
- Vite
- Plain CSS
- Jikan API
- Browser `localStorage`

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## API Notes

- The app uses Jikan public endpoints, which are browser-friendly for a client-side-only project.
- Entry links still open the canonical MyAnimeList title pages in a new tab.
- No user account or backend is required.

## Public URL

- Repo URL: [https://github.com/Ekkusuu/web-repo](https://github.com/Ekkusuu/web-repo)
- Live URL: [https://ekkusuu.github.io/web-repo/lab6/](https://ekkusuu.github.io/web-repo/lab6/)

## Deployment

The repository GitHub Pages workflow is configured to:

1. Check out the `lab6` branch.
2. Build the Vite app inside `lab6/`.
3. Publish the generated files to the `/lab6/` path on Pages.
