# Xandeum pNode Analytics Backend

Production-ready analytics backend for Xandeum pNode Explorer. This backend uses the official xandeum-prpc client to discover pNodes via the gossip network and expose analytics through a REST API.

In addition to raw pNode metrics, the platform derives operational insights such as health scoring, storage pressure, and network stability, enabling fast understanding of Xandeum network health. The dashboard includes a global pNode map that visualizes geographic distribution, health, uptime, and storage utilization, enabling quick assessment of decentralization and operational risk.

## Overview

The backend discovers Xandeum pNodes via gossip using the official `xandeum-prpc` TypeScript client, aggregates analytics, and exposes clean REST APIs for a SPA dashboard. The backend does not expose pRPC directly to the frontend, providing a clean abstraction layer.

## Tech Stack

- **Node.js** 20+ (required by xandeum-prpc@0.1.6)
- **TypeScript**
- **Fastify** - High-performance web framework
- **xandeum-prpc** (v0.1.6) - Official pRPC client
- **Zod** - Schema validation
- **Redis** - Distributed caching (with in-memory fallback)
- **Background Jobs** - Stats enrichment for RAM/storage data

## Project Structure

```
src/
 ├─ server.ts                 # Main Fastify server
 ├─ config/
 │   └─ prpc.ts              # pRPC client configuration
 ├─ services/
 │   ├─ pnode.service.ts           # pNode discovery and management
 │   ├─ analytics.service.ts       # Analytics calculations
 │   ├─ redis.service.ts           # Redis caching (with in-memory fallback)
 │   ├─ stats-enrichment.service.ts # Background stats enrichment
 │   ├─ geo.service.ts             # IP geolocation resolution
 │   └─ map.service.ts             # Map data aggregation
 ├─ routes/
 │   ├─ pnodes.ts            # pNode endpoints
 │   ├─ analytics.ts         # Analytics endpoints
 │   └─ health.ts            # Health check endpoint
 ├─ types/
 │   └─ pnode.ts             # TypeScript type definitions
 └─ utils/
     └─ format.ts            # Data normalization utilities
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Running Locally

### Development Mode

Run with hot-reload using `tsx`:
```bash
npm run dev
```

### Production Mode

Build and run:
```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` by default.

## Environment Variables

Optional environment variables:

- `PORT` - Server port (default: `3000`)
- `HOST` - Server host (default: `0.0.0.0`)
- `LOG_LEVEL` - Logging level (default: `info`)
- `REDIS_URL` - Redis connection URL (default: `redis://localhost:6379`)
- `ONLINE_THRESHOLD_SECONDS` - Online status threshold in seconds (default: `300`)
- `DEBUG_CALCULATIONS` - Enable debug logging for calculations (default: `false`)

**Note:** If Redis is not available, the backend will automatically fall back to in-memory caching.

Example:
```bash
PORT=8080 HOST=127.0.0.1 REDIS_URL=redis://localhost:6379 npm run dev
```

## API Endpoints

### Health Check

**GET** `/health`

Simple backend health check.

**Response:**
```json
{
  "status": "ok"
}
```

### pNodes

**GET** `/pnodes`

Returns all discovered pNodes. Results are cached for 30 seconds.

**Response:**
```json
[
  {
    "pubkey": "string",
    "status": "online" | "offline",
    "version": "string",
    "storageUsed": 0,
    "storageTotal": 0,
    "uptime": 0,
    "ip": "string",
    "lastSeen": "string",
    "ramUsed": 0,
    "ramTotal": 0
  }
]
```

**Note:** RAM data (`ramUsed`, `ramTotal`) is pre-fetched in the background and may not be available for all nodes immediately.

**GET** `/pnodes/:pubkey`

Returns detailed data for a single pNode.

**Response:**
```json
{
  "pubkey": "string",
  "status": "online" | "offline",
  "version": "string",
  "storageUsed": 0,
  "storageTotal": 0,
  "uptime": 0,
  "ip": "string",
  "lastSeen": "string",
  "ramUsed": 0,
  "ramTotal": 0
}
```

**Status Codes:**
- `200` - Success
- `404` - pNode not found
- `500` - Internal server error

**GET** `/pnodes/:pubkey/stats`

Returns detailed runtime stats for a specific pNode (CPU, RAM, active streams, etc.). Requires direct connection to the node.

**Response:**
```json
{
  "timestamp": "string",
  "cpu_percent": 0,
  "ram_used": 0,
  "ram_total": 0,
  "active_streams": 0
}
```

**Status Codes:**
- `200` - Success
- `404` - Stats not available (node offline or unreachable)
- `500` - Internal server error

**Note:** Stats are cached for 120 seconds to reduce pRPC load. Only online nodes can provide stats.

**GET** `/pnodes/map`

Returns all pNodes with geographic and health data for map visualization. Geo data is resolved from IP addresses using ip-api.com (free, no key required). Results are cached for 24 hours per IP.

**Response:**
```json
[
  {
    "pubkey": "string",
    "lat": 0,
    "lng": 0,
    "country": "string",
    "region": "string",
    "status": "online" | "offline",
    "healthScore": 0,
    "uptime24h": 0,
    "storageUtilization": 0,
    "version": "string",
    "lastSeen": "string"
  }
]
```

**Note:** Only nodes with valid IP addresses and successful geo resolution are included in the response. Geo resolution failures do not block the response.

### Analytics

**GET** `/analytics/summary`

Used for top dashboard cards. Provides overall network statistics.

**Response:**
```json
{
  "totalPNodes": 0,
  "onlinePNodes": 0,
  "onlinePercentage": 0,
  "averageUptime": 0,
  "totalStorageUsed": 0,
  "totalStorageCapacity": 0,
  "totalStorageUsedTB": 0,
  "totalStorageCapacityTB": 0,
  "networkHealth": "healthy" | "degraded" | "unstable",
  "consensusVersion": "string"
}
```

**Note:** Storage calculations only include online/active nodes. `consensusVersion` is the most common version used by nodes.

**Network Health Rules:**
- `healthy` - ≥ 95% online
- `degraded` - 85-94% online
- `unstable` - < 85% online

**GET** `/analytics/storage`

Used for storage utilization charts.

**Response:**
```json
[
  {
    "pubkey": "string",
    "storageUsed": 0,
    "storageTotal": 0,
    "utilizationPercent": 0
  }
]
```

**GET** `/analytics/versions`

Used for version distribution chart.

**Response:**
```json
[
  {
    "version": "string",
    "count": 0
  }
]
```

**GET** `/analytics/extended-summary`

Returns extended analytics with advanced metrics including health scores and storage pressure.

**Response:**
```json
{
  "totalPNodes": 0,
  "onlinePercentage": 0,
  "averageUptime24h": 0,
  "averageHealthScore": 0,
  "storagePressurePercent": 0,
  "networkHealth": "healthy" | "degraded" | "unstable"
}
```

**GET** `/analytics/node-metrics`

Returns per-node metrics with health scores, uptime, and storage utilization.

**Response:**
```json
[
  {
    "pubkey": "string",
    "healthScore": 0,
    "uptime24h": 0,
    "storageUtilization": 0,
    "tier": "Excellent" | "Good" | "Poor"
  }
]
```

**GET** `/analytics/top-nodes`

Returns top 10 performing nodes by health score.

**Response:**
```json
[
  {
    "pubkey": "string",
    "healthScore": 0,
    "uptime24h": 0
  }
]
```

**GET** `/analytics/storage-pressure`

Returns storage pressure metrics indicating nodes at risk of running out of space.

**Response:**
```json
{
  "highPressureNodes": 0,
  "totalNodes": 0,
  "percent": 0
}
```

**Note:** High pressure nodes are those with >80% storage utilization.

**GET** `/analytics/geo-summary`

Returns geographic distribution summary (countries and regions).

**Response:**
```json
{
  "countries": [
    { "country": "Germany", "count": 14 },
    { "country": "USA", "count": 9 }
  ],
  "regions": [
    { "region": "EU", "count": 23 }
  ]
}
```

## API Examples

### Get All pNodes

```bash
curl http://localhost:3000/pnodes
```

### Get Specific pNode

```bash
curl http://localhost:3000/pnodes/ABC123...
```

### Get Analytics Summary

```bash
curl http://localhost:3000/analytics/summary
```

### Get Storage Analytics

```bash
curl http://localhost:3000/analytics/storage
```

### Get Version Distribution

```bash
curl http://localhost:3000/analytics/versions
```

### Get Extended Summary

```bash
curl http://localhost:3000/analytics/extended-summary
```

### Get Node Metrics

```bash
curl http://localhost:3000/analytics/node-metrics
```

### Get Top Nodes

```bash
curl http://localhost:3000/analytics/top-nodes
```

### Get Storage Pressure

```bash
curl http://localhost:3000/analytics/storage-pressure
```

### Get Node Stats

```bash
curl http://localhost:3000/pnodes/ABC123.../stats
```

## Architecture

### pNode Discovery

The backend uses gossip discovery via the `xandeum-prpc` client. Seed IPs are configured in `src/config/prpc.ts`:

- 173.212.220.65
- 161.97.97.41
- 192.190.136.36
- 192.190.136.38
- 207.244.255.1
- 192.190.136.28
- 192.190.136.29
- 173.212.203.145

### Caching

- **Redis-backed caching** (with in-memory fallback) for all data types:
  - **pNode data**: 30-second TTL (Redis with in-memory fallback)
  - **Node stats** (RAM/storage): 120-second TTL (Redis with in-memory fallback)
  - **Analytics metrics**: 60-second TTL (Redis with in-memory fallback)
  - **Geo location data**: 24-hour TTL (Redis with in-memory fallback)
  - Persistent across server restarts
  - Shared across multiple instances
  - Automatically falls back to in-memory cache if Redis is unavailable
- Shared cache for all analytics endpoints to avoid redundant calculations
- Prevents excessive gossip calls and reduces pRPC load
- Fast response times (< 200ms for cached requests)

### Background Stats Enrichment

A background job runs every 90 seconds to pre-fetch and cache RAM/storage stats for all online nodes:
- Processes nodes in batches of 15 with 100ms delays
- Caches results in Redis (120-second TTL)
- Reduces pRPC load by batching requests
- Enriches pNode responses with RAM data automatically
- Prevents overlapping runs with internal locking

### IP Geolocation

The backend uses ip-api.com (free, no key required) to resolve IP addresses to geographic locations. Geo data is:
- Cached for 24 hours per IP address in Redis
- Resolved asynchronously (does not block responses)
- Only includes nodes with valid IP addresses and successful geo resolution
- Rate limit: 45 requests/minute (ip-api.com free tier)

### Error Handling

- Never exposes raw pRPC errors to clients
- Always returns structured JSON error responses
- Internal errors are logged for debugging
- Graceful degradation if gossip is slow/unavailable

### Performance

- pRPC calls are cached and not made on every request
- Analytics endpoints reuse cached computed metrics
- Background stats enrichment keeps cache warm
- API responses < 200ms when cached
- Stateless design (no database required)
- Redis caching enables horizontal scaling

## Development

### Type Checking

```bash
npm run type-check
```

### Building

```bash
npm run build
```

## 🚀 Deployment

### Option A: Railway (Recommended)

1. Go to [Railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub**
3. Select your repository
4. Set **Root Directory** to `/backend` or `/Xandeum-pnode-backend`
5. Railway will auto-detect Node.js from `.nvmrc` or `package.json` engines

**Important:** Ensure Node.js 20+ is used. Railway should detect this from:
- `.nvmrc` file (contains `20`)
- `package.json` engines field (`"node": ">=20.0.0"`)

**Build & Start Commands:**
```
Build Command: npm install && npm run build
Start Command: node dist/server.js
```

**If Railway still uses Node 18, fix it:**
1. Go to your Railway project → **Settings** → **Variables**
2. Add environment variable: `NODE_VERSION=20`
3. Redeploy the service

**Alternative:** Railway should automatically detect Node 20 from:
- `.nvmrc` file (already created in this repo)
- `package.json` engines field (already set to `>=20.0.0`)

If it still doesn't work, you can also create a `nixpacks.toml` file in the root directory:
```toml
[phases.setup]
nixPkgs = ["nodejs_20"]
```

**Environment Variables (Optional):**
```
NODE_ENV=production
PORT=3000
REDIS_URL=redis://localhost:6379  # If using Railway Redis
ONLINE_THRESHOLD_SECONDS=300
```

6. Deploy and get your backend URL (e.g., `https://xandeum-backend.up.railway.app`)

### Option B: Render

1. Go to [Render.com](https://render.com)
2. **New** → **Web Service**
3. Connect your GitHub repository
4. Set **Root Directory** to `backend` or `Xandeum-pnode-backend`
5. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/server.js`
   - **Environment**: Node
   - **Node Version**: 20 (Render will detect from `.nvmrc` or `package.json`)

6. Add environment variables if needed
7. Deploy

### Option C: Other Platforms

The backend is a standard Node.js application and can be deployed to:
- **Heroku**: Use Node.js buildpack
- **DigitalOcean App Platform**: Select Node.js
- **AWS Elastic Beanstalk**: Node.js platform
- **Any VPS**: Run `npm install && npm run build && npm start`

### Post-Deployment

1. Test health endpoint: `https://your-backend-url.com/health`
2. Test pNodes endpoint: `https://your-backend-url.com/pnodes`
3. Update frontend `VITE_API_URL` environment variable
4. Configure CORS if needed (already configured for common origins)

## Production Considerations

- The backend is stateless and can be horizontally scaled
- Redis is recommended for distributed caching in multi-instance deployments
- Background stats enrichment runs automatically on server startup
- Monitor pRPC connection health and Redis connectivity
- Set appropriate CORS origins for production
- Configure proper logging levels
- Adjust `ONLINE_THRESHOLD_SECONDS` if needed for your network conditions

## License

MIT

