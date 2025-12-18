import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health";
import { pnodeRoutes } from "./routes/pnodes";
import { analyticsRoutes } from "./routes/analytics";
import { initRedis, closeRedis } from "./services/redis.service";
import { startStatsEnrichmentJob, stopStatsEnrichmentJob } from "./services/stats-enrichment.service";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  // Register CORS if needed for frontend
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(pnodeRoutes);
  await fastify.register(analyticsRoutes);

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    console.error("Unhandled error:", error);
    reply.code(500).send({
      error: "Internal server error",
      message: error.message || "An unexpected error occurred",
    });
  });

  return fastify;
}

async function start() {
  try {
    // Initialize Redis (will fallback to in-memory if unavailable)
    // Don't block server startup if Redis fails
    initRedis()
      .then(() => {
        // Start background job to pre-fetch and cache stats in Redis
        startStatsEnrichmentJob();
      })
      .catch((error) => {
        console.warn('⚠️ Redis initialization failed, continuing with in-memory cache:', error instanceof Error ? error.message : error);
      });
    
    const server = await buildServer();
    
    await server.listen({ port: PORT, host: HOST });
    
    console.log(`🚀 Xandeum pNode Analytics Backend running on http://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
    console.log(`🔍 pNodes endpoint: http://${HOST}:${PORT}/pnodes`);
    console.log(`📈 Analytics endpoint: http://${HOST}:${PORT}/analytics/summary`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  stopStatsEnrichmentJob();
  await closeRedis();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  stopStatsEnrichmentJob();
  await closeRedis();
  process.exit(0);
});

start();

