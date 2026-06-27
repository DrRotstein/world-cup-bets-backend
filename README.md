# world-cup-bets-backend

Backend API for the World Cup Bets app — a casual friend-group betting pool for FIFA World Cup 2026.

## Stack

- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS 10
- **Language:** TypeScript 5
- **ORM:** Prisma 5
- **Database:** PostgreSQL 16
- **Deploy:** Railway

See [ADR-001](https://github.com/DrRotstein/world-cup-bets-docs/blob/main/architecture/adr/ADR-001-stack-choice.md) for the full stack rationale.

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16 running locally (or a connection string to a remote instance)
- Copy `.env.example` to `.env` and fill in values

### Install & Setup

```bash
# Install dependencies (also runs prisma generate automatically)
npm install

# Run database migrations
npx prisma migrate deploy

# Start in development mode (hot-reload)
npm run start:dev
```

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `7d`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `FOOTBALL_DATA_API_KEY` | API key for football-data.org |

### Running Tests

```bash
# Unit tests
npm test

# E2e tests (no DB required — mocked)
npm run test:e2e

# With coverage
npm run test:cov
```

### Building for Production

```bash
npm run build
npm run start:prod
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/google` | Exchange Google ID token for JWT |
| `GET` | `/auth/me` | Get current user profile |
| `POST` | `/groups` | Create a group |
| `GET` | `/groups` | List user's groups |
| `POST` | `/groups/join` | Join group via invite code |
| `GET` | `/groups/:id` | Get group details |
| `GET` | `/matches` | List matches (filterable) |
| `POST` | `/matches/sync` | Trigger manual match sync |
| `POST` | `/groups/:groupId/bets` | Place/update a bet |
| `GET` | `/groups/:groupId/bets` | Get bets for a match |
| `GET` | `/groups/:groupId/leaderboard` | Group leaderboard |
| `GET` | `/groups/:groupId/leaderboard/:userId` | Per-user breakdown |

All endpoints except `/auth/google` require `Authorization: Bearer <jwt>`.

## License

TBD
