import { FastifyInstance } from "fastify";
import {
  getAnalyticsSummary,
  getStorageAnalytics,
  getVersionDistribution,
  getExtendedSummary,
  getNodeMetrics,
  getTopNodes,
  getStoragePressure,
} from "../services/analytics.service";
import { getGeoSummary } from "../services/map.service";
import {
  AnalyticsSummary,
  StorageAnalytics,
  VersionDistribution,
  ExtendedSummary,
  NodeMetrics,
  TopNode,
  StoragePressure,
  GeoSummary,
} from "../types/pnode";

export async function analyticsRoutes(fastify: FastifyInstance) {
  // GET /analytics/summary - Get analytics summary
  fastify.get<{ Reply: AnalyticsSummary }>(
    "/analytics/summary",
    async (_request, reply) => {
      try {
        const summary = await getAnalyticsSummary();
        return reply.code(200).send(summary);
      } catch (error) {
        console.error("Error fetching analytics summary:", error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch analytics summary",
        } as any);
      }
    }
  );

  // GET /analytics/storage - Get storage analytics
  fastify.get<{ Reply: StorageAnalytics[] }>(
    "/analytics/storage",
    async (_request, reply) => {
      try {
        const storage = await getStorageAnalytics();
        return reply.code(200).send(storage);
      } catch (error) {
        console.error("Error fetching storage analytics:", error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch storage analytics",
        } as any);
      }
    }
  );

  // GET /analytics/versions - Get version distribution
  fastify.get<{ Reply: VersionDistribution[] }>(
    "/analytics/versions",
    async (_request, reply) => {
      try {
        const versions = await getVersionDistribution();
        return reply.code(200).send(versions);
      } catch (error) {
        console.error("Error fetching version distribution:", error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch version distribution",
        } as any);
      }
    }
  );

  // GET /analytics/extended-summary - Get extended analytics summary
  fastify.get<{ Reply: ExtendedSummary }>(
    "/analytics/extended-summary",
    async (_request, reply) => {
      try {
        const summary = await getExtendedSummary();
        return reply.code(200).send(summary);
      } catch (error) {
        console.error("Error fetching extended summary:", error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch extended summary",
        } as any);
      }
    }
  );

  // GET /analytics/node-metrics - Get per-node metrics
  fastify.get<{ Reply: NodeMetrics[] }>(
    "/analytics/node-metrics",
    async (_request, reply) => {
      try {
        const metrics = await getNodeMetrics();
        return reply.code(200).send(metrics);
      } catch (error) {
        console.error("Error fetching node metrics:", error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch node metrics",
        } as any);
      }
    }
  );

  // GET /analytics/top-nodes - Get top performing nodes
  fastify.get<{ Reply: TopNode[] }>(
    "/analytics/top-nodes",
    async (_request, reply) => {
      try {
        const topNodes = await getTopNodes();
        return reply.code(200).send(topNodes);
      } catch (error) {
        console.error("Error fetching top nodes:", error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch top nodes",
        } as any);
      }
    }
  );

  // GET /analytics/storage-pressure - Get storage pressure metrics
  fastify.get<{ Reply: StoragePressure }>(
    "/analytics/storage-pressure",
    async (_request, reply) => {
      try {
        const pressure = await getStoragePressure();
        return reply.code(200).send(pressure);
      } catch (error) {
        console.error("Error fetching storage pressure:", error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch storage pressure",
        } as any);
      }
    }
  );

  // GET /analytics/geo-summary - Get geographic distribution summary
  fastify.get<{ Reply: GeoSummary }>(
    "/analytics/geo-summary",
    async (_request, reply) => {
      try {
        const summary = await getGeoSummary();
        return reply.code(200).send(summary);
      } catch (error) {
        console.error("Error fetching geo summary:", error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch geo summary",
        } as any);
      }
    }
  );
}

