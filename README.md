# Xandeum pNode Analytics Backend

Production-ready analytics backend for Xandeum pNode Explorer. Discovers pNodes via gossip network using the official `xandeum-prpc` client and exposes analytics through a REST API.

## Tech Stack

- **Node.js** 20+ (required by xandeum-prpc@0.1.6)
- **TypeScript**
- **Fastify** - High-performance web framework
- **xandeum-prpc** (v0.1.6) - Official pRPC client
- **Redis** - Distributed caching (with in-memory fallback)
- **Background Jobs** - Stats enrichment for RAM/storage data

## Key Features

- Real-time pNode discovery via gossip network
- Health scoring (uptime + storage + online status)
- Storage pressure detection (>80% threshold)
- Network health classification (healthy/degraded/unstable)
- Geographic distribution analytics
- Background stats enrichment (RAM/storage pre-fetching)
- Multi-layer caching (Redis + in-memory) for performance

## Quick Start

```bash
npm install
npm run build
npm start
```

Server runs on `http://localhost:3000` by default.

## Environment Variables

- `PORT` - Server port (default: `3000`)
- `REDIS_URL` - Redis connection URL (optional, falls back to in-memory)
- `ONLINE_THRESHOLD_SECONDS` - Online status threshold (default: `300`)

## API Endpoints

### Core
- `GET /pnodes` - All pNodes with RAM data
- `GET /pnodes/:pubkey` - Single pNode details
- `GET /pnodes/:pubkey/stats` - Node runtime stats
- `GET /pnodes/map` - Map data with geographic coordinates

### Analytics
- `GET /analytics/summary` - Network statistics (total pods, online %, storage, consensus version)
- `GET /analytics/extended-summary` - Advanced metrics (health scores, storage pressure)
- `GET /analytics/node-metrics` - Per-node metrics with health scores
- `GET /analytics/top-nodes` - Top 10 performing nodes
- `GET /analytics/storage-pressure` - Storage pressure metrics
- `GET /analytics/storage` - Storage utilization data
- `GET /analytics/versions` - Version distribution
- `GET /analytics/geo-summary` - Geographic distribution

## Architecture

### pNode Discovery
Uses gossip discovery via `xandeum-prpc` client with seed IPs configured in `src/config/prpc.ts`.

### Caching
- **Redis-backed caching** (with in-memory fallback) for all data types
- pNode data: 30-second TTL
- Node stats: 120-second TTL
- Analytics metrics: 60-second TTL
- Geo location: 24-hour TTL
- Fast response times (< 200ms for cached requests)

### Background Stats Enrichment
Background job runs every 90 seconds to pre-fetch and cache RAM/storage stats for all online nodes, reducing pRPC load.

## Deployment

### Railway (Recommended)

1. Deploy from GitHub
2. Set root directory to `/Xandeum-pnode-backend`
3. Build: `npm install && npm run build`
4. Start: `node dist/server.js`

Railway will auto-detect Node.js 20 from `.nvmrc` or `package.json`.

### Environment Variables
```
NODE_ENV=production
PORT=3000
REDIS_URL=redis://localhost:6379  # Optional
```

## License

MIT
