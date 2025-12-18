import { FastifyInstance } from "fastify";
import { getAllPNodes, getPNodeByPubkey, getNodeStatsByPubkey } from "../services/pnode.service";
import { getMapNodes } from "../services/map.service";
import { PNode, NodeStats, MapNode } from "../types/pnode";

export async function pnodeRoutes(fastify: FastifyInstance) {
  // GET /pnodes - Get all pNodes
  fastify.get<{ Reply: PNode[] }>("/pnodes", async (_request, reply) => {
    try {
      const nodes = await getAllPNodes();
      
      // Log RAM data statistics
      const withRam = nodes.filter(n => n.ramUsed !== undefined && n.ramTotal !== undefined).length;
      const onlineWithRam = nodes.filter(n => n.status === 'online' && n.ramUsed !== undefined && n.ramTotal !== undefined).length;
      const onlineTotal = nodes.filter(n => n.status === 'online').length;
      
      console.log(`📡 /pnodes API Response: ${nodes.length} total nodes`);
      console.log(`   ✅ ${withRam} nodes have RAM data (${onlineWithRam}/${onlineTotal} online nodes with RAM)`);
      
      return reply.code(200).send(nodes);
    } catch (error) {
      console.error("Error fetching pNodes:", error);
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to fetch pNodes",
      } as any);
    }
  });

  // GET /pnodes/:pubkey - Get single pNode by pubkey
  fastify.get<{ Params: { pubkey: string }; Reply: PNode }>(
    "/pnodes/:pubkey",
    async (request, reply) => {
      try {
        const { pubkey } = request.params;
        const node = await getPNodeByPubkey(pubkey);

        if (!node) {
          return reply.code(404).send({
            error: "Not found",
            message: `pNode with pubkey ${pubkey} not found`,
          } as any);
        }

        return reply.code(200).send(node);
      } catch (error) {
        console.error("Error fetching pNode:", error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch pNode",
        } as any);
      }
    }
  );

  // GET /pnodes/:pubkey/stats - Get detailed NodeStats for a specific pNode
  fastify.get<{ Params: { pubkey: string }; Reply: NodeStats }>(
    "/pnodes/:pubkey/stats",
    async (request, reply) => {
      try {
        const { pubkey } = request.params;
        const stats = await getNodeStatsByPubkey(pubkey);

        if (!stats) {
          return reply.code(404).send({
            error: "Not found",
            message: `Stats for pNode with pubkey ${pubkey} not found or unavailable`,
          } as any);
        }

        return reply.code(200).send(stats);
      } catch (error) {
        console.error(`Error fetching stats for pNode ${request.params.pubkey}:`, error);
        return reply.code(500).send({
          error: "Internal server error",
          message: "Failed to fetch node stats",
        } as any);
      }
    }
  );

  // GET /pnodes/map - Get all pNodes with geographic and health data for map
  fastify.get<{ Reply: MapNode[] }>(
    "/pnodes/map",
    async (_request, reply) => {
      try {
        const mapNodes = await getMapNodes();
        return reply.code(200).send(mapNodes);
      } catch (error) {
        // Return empty array instead of error to prevent frontend breakage
        // The frontend can handle empty arrays gracefully
        return reply.code(200).send([]);
      }
    }
  );
}

