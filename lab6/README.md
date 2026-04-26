# AniLog Terminal

AniLog Terminal is a client-side React app for tracking anime and manga through the MyAnimeList API.

The app keeps a local terminal-style vault where users can save titles from discovery feeds, search results, or their authenticated MAL account. Everything runs in the browser only.

## Topic

- Anime and manga discovery + personal vault
- Data source: MyAnimeList API
- Visual style: minimalist terminal/code workspace with dark, light, and grayscale variants

## Main Flows

1. Open the app and load public MAL discovery feeds.
2. Browse current seasonal anime and top ranked manga.
3. Search the MAL catalog for specific anime or manga titles.
4. Save interesting titles into the local vault.
5. Like, remove, and filter saved entries by type, source, and search text.
6. Log in with a MyAnimeList account through OAuth PKCE.
7. Import the user anime list or manga list into the local vault.
8. Reopen the app later and continue from persisted browser storage.

## Lab Requirements Coverage

- Entities that can be manipulated:
  - anime titles
  - manga titles
  - actions: save, remove, like, filter, import
- Custom theme/style:
  - monochrome terminal-inspired layout
  - dark and light theme switch
- Public hosting:
  - configured for GitHub Pages under `/web-repo/lab6/`
- Front-end framework:
  - React
- Runtime state:
  - in-memory React state for views, filters, discovery data, search data, and session UI
- Browser persistence:
  - `localStorage` for theme, local vault, MAL session, and cached profile
- Git history:
  - built as a sequence of focused commits

## Features

- Seasonal anime feed from MAL
- Top manga ranking feed from MAL
- MAL catalog search for anime and manga
- Local vault with add/remove/like actions
- Vault filters by title text, type, source, and liked state
- MAL OAuth login with PKCE
- MAL anime list import
- MAL manga list import
- Responsive layout for desktop and mobile
- Dark/light terminal theme

## Views

### `discover`

- Loads seasonal anime and top manga from MAL public endpoints
- Lets the user save or remove entries from the local vault

### `search`

- Searches anime or manga by title
- Lets the user save or remove results from the local vault

### `library`

- Shows all locally stored entries
- Supports filtering by:
  - text query
  - kind (`anime` / `manga`)
  - source (`seasonal`, `ranking`, `search`, `mal`)
  - liked only toggle

### `sync`

- Starts the MAL OAuth login flow
- Restores cached MAL sessions
- Shows authenticated profile details
- Imports the user anime list or manga list into the local vault

## Tech Stack

- React
- Vite
- Plain CSS
- MyAnimeList API
- OAuth 2.0 Authorization Code + PKCE
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

## MAL Setup

Create a MyAnimeList API application and configure a client ID.

Use these environment variables in `lab6/.env`:

```bash
VITE_MAL_CLIENT_ID=your_mal_client_id
VITE_MAL_REDIRECT_URI=https://ekkusuu.github.io/web-repo/lab6/
```

Notes:

- The redirect URI must match the MAL application configuration.
- This app uses PKCE and does not require a backend.
- Public discovery/search endpoints use `X-MAL-CLIENT-ID`.
- Authenticated list import uses the OAuth access token.

## Public URL

- Repo URL: `https://github.com/Ekkusuu/web-repo`
- Live URL: `https://ekkusuu.github.io/web-repo/lab6/`

## Deployment

The repository GitHub Pages workflow is configured to:

1. Check out the `lab6` branch.
2. Build the Vite app inside `lab6/`.
3. Publish the generated files to the `/lab6/` path on Pages.
