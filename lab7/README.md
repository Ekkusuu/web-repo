# AniLog API - Lab 7

AniLog API extends the Lab 6 anime and manga vault with a back-end CRUD API protected by short-lived JWT tokens.

The front-end keeps the same terminal-inspired interface from Lab 6, while the saved vault is now stored through the API instead of only in browser runtime state.

## Topic

- Anime and manga discovery + saved vault API
- Public discovery source: Jikan API
- Protected saved entries source: custom Express CRUD API
- Visual style: minimalist terminal/code workspace with dark and light themes

## Main Flows

1. Open `discover` and browse anime, manga, or novel feeds from the public catalog.
2. Open `api` and request a JWT with a selected role and permissions.
3. Use the token to save discovered titles into the API-backed vault.
4. Open `library` to read saved entries from the backend with filters and pagination.
5. Like or update entries with `WRITE` permission.
6. Delete entries with `DELETE` permission.
7. Open Swagger UI to inspect and test the documented endpoints.

## Lab 7 Requirement Coverage

- JWT-protected CRUD API:
  - `/token` returns a JWT
  - JWT stores `role` and `permissions`
  - tokens expire in 60 seconds
- Front-end connected with back-end:
  - token request UI in the client
  - save/load/update/delete actions call the backend API
- Swagger UI documentation:
  - `/docs`
- Appropriate status codes:
  - `200`, `201`, `204`, `400`, `401`, `403`, `404`
- Pagination support:
  - `GET /api/entries?limit=&offset=`
- Based on Lab 6 entities:
  - saved anime/manga vault entries

## Roles and Permissions

- `VISITOR`
  - `READ`
- `WRITER`
  - `READ`, `WRITE`
- `ADMIN`
  - `READ`, `WRITE`, `DELETE`

The token request UI also allows custom permission combinations for demos.

## API Endpoints

### `POST /token`

- Returns a JWT and token metadata
- Accepts JSON like:

```json
{
  "role": "ADMIN",
  "permissions": ["READ", "WRITE", "DELETE"]
}
```

### `GET /api/entries`

- Requires `READ`
- Supports:
  - `limit`
  - `offset`
  - `q`
  - `kind`
  - `source`
  - `liked`

### `GET /api/entries/:entryId`

- Requires `READ`

### `POST /api/entries`

- Requires `WRITE`

### `PUT /api/entries/:entryId`

- Requires `WRITE`

### `DELETE /api/entries/:entryId`

- Requires `DELETE`

## Front-end Views

### `discover`

- Public anime, manga, and novel browsing
- Infinite scroll for discovery feeds
- Save action wired to the backend API when a token allows it

### `search`

- Public catalog search for anime and manga
- Save action wired to the backend API when a token allows it

### `library`

- API-backed saved entries list
- Filtered reads using query parameters
- Paginated reads with `limit` and `offset`

### `api`

- Request and inspect JWTs
- Open Swagger UI and OpenAPI JSON
- Review endpoint permissions

## Tech Stack

- React
- Vite
- Express
- JWT (`jsonwebtoken`)
- Swagger UI (`swagger-ui-express`)
- OpenAPI JSON
- Jikan API

## Development

Install dependencies:

```bash
npm install
```

Run client and server together:

```bash
npm run dev:full
```

Run only the API server:

```bash
npm run dev:server
```

Run only the client:

```bash
npm run dev
```

Create a production client build:

```bash
npm run build
```

## Local URLs

- Front-end: [http://localhost:5174](http://localhost:5174)
- API health: [http://localhost:3001/health](http://localhost:3001/health)
- Swagger UI: [http://localhost:3001/docs](http://localhost:3001/docs)
- OpenAPI JSON: [http://localhost:3001/openapi.json](http://localhost:3001/openapi.json)

## Notes

- The public discovery/search feed still uses Jikan because it works in a client-side browser context.
- The saved vault is now managed by the Express API.
- The API currently persists entries to `server/data/entries.json` for demo purposes.
