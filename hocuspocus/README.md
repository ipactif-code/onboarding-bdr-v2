# Hocuspocus Server - Knowledge Base Real-Time Collaboration

Standalone Hocuspocus server for Yjs document synchronization in the BDR LMS Knowledge Base feature.

## Overview

This server handles real-time collaborative editing for Knowledge Base documents using the Yjs CRDT (Conflict-free Replicated Data Type) framework. It authenticates users via Clerk JWT tokens.

## Requirements

- Node.js >= 18.17.0
- pnpm
- Clerk account with secret key

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Configure environment variables:

```env
PORT=1234
CLERK_SECRET_KEY=sk_live_xxxxx
NODE_ENV=development
```

## Development

Start the development server with hot reloading:

```bash
pnpm dev
```

## Production

Build and start:

```bash
pnpm build
pnpm start
```

## Deployment (Railway)

1. Create a new Railway project
2. Connect your repository
3. Set root directory to `hocuspocus/`
4. Configure environment variables:
   - `PORT` (Railway sets this automatically)
   - `CLERK_SECRET_KEY`
   - `NODE_ENV=production`
5. Deploy

Estimated cost: ~$10-20/month depending on usage.

## Connection

Clients connect via WebSocket with a Clerk JWT token:

```typescript
import { HocuspocusProvider } from '@hocuspocus/provider';

const provider = new HocuspocusProvider({
  url: 'wss://your-server.railway.app',
  name: 'kb-doc-{documentId}',
  token: clerkToken, // JWT from Clerk
});
```

## Room Naming Convention

Documents use the naming pattern: `kb-doc-{documentId}`

Where `{documentId}` is the Convex document ID.

## Authentication Flow

1. Client requests JWT from Next.js app (via Clerk)
2. Client connects to Hocuspocus with token in connection params
3. Hocuspocus `onAuthenticate` validates token via Clerk SDK
4. Valid users connect; invalid users are rejected

## Logs

The server logs all connection events:

```
[2024-01-08T12:00:00.000Z] [INFO] [AUTH] User authenticated successfully {...}
[2024-01-08T12:00:00.000Z] [INFO] [CONNECT] User connected {...}
[2024-01-08T12:00:00.000Z] [INFO] [DISCONNECT] User disconnected {...}
```

## Docker Support

### Production Build

Run the server in a Docker container:

```bash
# Copy environment file
cp .env.example .env

# Edit .env and add your CLERK_SECRET_KEY

# Build and start
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Development Build (with hot reload)

Run with volume mounting for live code updates:

```bash
# Copy environment file
cp .env.example .env

# Build and start development container
docker-compose -f docker-compose.dev.yml up --build

# Stop
docker-compose -f docker-compose.dev.yml down
```

### Health Check

The server provides a health check endpoint for Docker and monitoring on port 1235 (PORT+1):

```bash
curl http://localhost:1235/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-08T12:00:00.000Z",
  "wsPort": 1234,
  "healthPort": 1235
}
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Compile TypeScript to JavaScript |
| `pnpm start` | Start production server |
| `pnpm typecheck` | Run TypeScript type checking |

## Troubleshooting

### Connection Refused

- Check if server is running: `curl http://localhost:1235/health`
- Verify WebSocket port is not in use: `lsof -i :1234`
- Verify health check port is not in use: `lsof -i :1235`
- Check Docker container logs: `docker-compose logs`

### Authentication Failures

- Verify `CLERK_SECRET_KEY` is correct and starts with `sk_`
- Check token expiration
- Ensure frontend is passing token correctly

### Hot Reload Not Working (Docker Dev)

- Verify volume mount in `docker-compose.dev.yml`
- Check file changes are being detected: `docker-compose -f docker-compose.dev.yml logs -f`
