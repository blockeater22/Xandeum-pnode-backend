import { prpcClient } from "../config/prpc";
import { SEED_IPS } from "../config/prpc";
import { PrpcClient } from "xandeum-prpc";
import { nodeCacheService, statsCacheService, analyticsCacheService } from "./redis.service";
import { enrichNodesWithCachedStats } from "./stats-enrichment.service";
import { normalizePNode } from "../utils/format";
import { PNode, NodeStats } from "../types/pnode";

const CACHE_KEY = "pnodes";
const CACHE_TTL_MS = 30 * 1000;

async function discoverPNodesViaGossip(): Promise<PNode[]> {
  const discoveredNodes: PNode[] = [];
  
  try {
    let response;
    try {
      response = await prpcClient.getPodsWithStats();
    } catch (statsError) {
      response = await prpcClient.getPods();
    }
    
    for (const pod of response.pods) {
      try {
        const normalized = normalizePNode(pod);
        if (normalized.pubkey) {
          discoveredNodes.push(normalized);
        }
      } catch (error) {
        // Continue processing other nodes
      }
    }
    
    if (discoveredNodes.length > 0) {
      return discoveredNodes;
    }
  } catch (error) {
    // Try fallback seeds
  }
  
  // Fallback: try other seed IPs if primary fails
  for (let i = 1; i < SEED_IPS.length && discoveredNodes.length === 0; i++) {
    try {
      const fallbackClient = new PrpcClient(SEED_IPS[i], { timeout: 5000 });
      const response = await fallbackClient.getPods();
      
      for (const pod of response.pods) {
        try {
          const normalized = normalizePNode(pod);
          if (normalized.pubkey) {
            discoveredNodes.push(normalized);
          }
        } catch (error) {
          // Continue processing other nodes
        }
      }
      
      // If we got nodes from fallback, break
      if (discoveredNodes.length > 0) {
        break;
      }
    } catch (error) {
      // Continue to next seed IP
    }
  }

  return discoveredNodes;
}

/**
 * Get all pNodes, using cache if available
 * Deduplicates nodes by pubkey to ensure consistency
 */
export async function getAllPNodes(): Promise<PNode[]> {
  // Check Redis cache first, then in-memory fallback
  const cached = await nodeCacheService.get<PNode[]>(CACHE_KEY);
  if (cached) {
    console.log(`📦 Using cached pNodes (${cached.length} nodes from Redis)`);
    // Enrich cached nodes with RAM data from Redis (fast, non-blocking)
    return enrichNodesWithCachedStats(cached);
  }

  console.log('🔍 Discovering pNodes via gossip (cache miss)...');
  // Discover nodes via gossip
  const nodes = await discoverPNodesViaGossip();
  console.log(`   Found ${nodes.length} nodes from gossip`);

  // Deduplicate by pubkey (keep first occurrence)
  // This ensures consistency between /pnodes and /analytics/summary
  const seen = new Map<string, PNode>();
  const uniqueNodes: PNode[] = [];
  
  for (const node of nodes) {
    if (!node.pubkey) continue;
    
    if (!seen.has(node.pubkey)) {
      seen.set(node.pubkey, node);
      uniqueNodes.push(node);
    }
  }

  console.log(`   Deduplicated to ${uniqueNodes.length} unique nodes`);
  console.log(`   Online: ${uniqueNodes.filter(n => n.status === 'online').length}, Offline: ${uniqueNodes.filter(n => n.status === 'offline').length}`);

  // Cache the deduplicated results in Redis (with in-memory fallback)
  await nodeCacheService.set(CACHE_KEY, uniqueNodes, CACHE_TTL_MS);
  console.log(`   ✅ Cached ${uniqueNodes.length} nodes in Redis`);

  // Enrich nodes with RAM data from Redis cache (non-blocking, fast)
  const enrichedNodes = await enrichNodesWithCachedStats(uniqueNodes);

  return enrichedNodes;
}

export async function getPNodeByPubkey(pubkey: string): Promise<PNode | null> {
  const nodes = await getAllPNodes();
  return nodes.find((node) => node.pubkey === pubkey) || null;
}

export async function refreshPNodes(): Promise<PNode[]> {
  await nodeCacheService.delete(CACHE_KEY);
  return getAllPNodes();
}

export async function getNodeStatsByPubkey(pubkey: string): Promise<NodeStats | null> {
  const CACHE_KEY = `node_stats_${pubkey}`;
  const CACHE_TTL_MS = 120 * 1000;

  const cached = await statsCacheService.get<NodeStats>(CACHE_KEY);
  if (cached) {
    return cached;
  }

  try {
    const node = await getPNodeByPubkey(pubkey);
    if (!node) {
      return null;
    }

    if (node.status !== 'online') {
      return null;
    }

    const nodeAddress = node.address || node.ip;
    if (!nodeAddress) {
      return null;
    }

    const nodeIp = nodeAddress.split(':')[0];
    const nodeClient = new PrpcClient(nodeIp, { timeout: 8000 });
    const stats = await nodeClient.getStats();

    if (stats) {
      await statsCacheService.set(CACHE_KEY, stats, CACHE_TTL_MS);
    }

    return stats;
  } catch (error) {
    const isExpectedError = error instanceof Error && (
      error.message.includes('timeout') ||
      error.message.includes('timed out') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('EHOSTUNREACH') ||
      error.message.includes('ETIMEDOUT')
    );
    
    if (!isExpectedError) {
      console.error(`Unexpected error fetching stats for node ${pubkey}:`, error);
    }
    
    return null;
  }
}

export async function getRawPodsForAnalytics(): Promise<import("xandeum-prpc").Pod[]> {
  const CACHE_KEY_ANALYTICS = "pods_raw_analytics";
  const CACHE_TTL_MS_ANALYTICS = 60 * 1000;

  const cached = await analyticsCacheService.get<import("xandeum-prpc").Pod[]>(CACHE_KEY_ANALYTICS);
  if (cached) {
    return cached;
  }

  try {
    const response = await prpcClient.getPodsWithStats();
    const pods = response.pods || [];
    await analyticsCacheService.set(CACHE_KEY_ANALYTICS, pods, CACHE_TTL_MS_ANALYTICS);
    return pods;
  } catch (error) {
    const response = await prpcClient.getPods();
    const pods = response.pods || [];
    await analyticsCacheService.set(CACHE_KEY_ANALYTICS, pods, CACHE_TTL_MS_ANALYTICS);
    return pods;
  }
}

