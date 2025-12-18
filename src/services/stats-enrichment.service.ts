/**
 * Stats Enrichment Service
 * 
 * Pre-fetches and caches RAM/storage stats for all nodes in the background.
 * This reduces pRPC load by batching requests and caching results in Redis.
 */

import { getAllPNodes, getNodeStatsByPubkey } from "./pnode.service";
import { statsCacheService } from "./redis.service";
import { PNode } from "../types/pnode";

const ENRICHMENT_INTERVAL_MS = 90 * 1000; // Run every 90 seconds (give more time for completion)
const BATCH_SIZE = 15; // Process 15 nodes at a time (increase batch size)
const BATCH_DELAY_MS = 100; // 100ms delay between batches (reduce delay for faster completion)

// Prevent overlapping pre-fetch runs
let isRunning = false;

/**
 * Enrich a single node with RAM data from cached stats
 */
async function enrichNodeWithStats(node: PNode): Promise<PNode> {
  // Check if we already have stats cached
  const cacheKey = `node_stats_${node.pubkey}`;
  const cachedStats = await statsCacheService.get<any>(cacheKey);
  
  if (cachedStats && cachedStats.ram_used !== undefined && cachedStats.ram_total !== undefined) {
    return {
      ...node,
      ramUsed: cachedStats.ram_used,
      ramTotal: cachedStats.ram_total,
    };
  }
  
  return node;
}

/**
 * Pre-fetch stats for all online nodes and cache in Redis
 * This runs in the background to keep Redis cache warm
 */
export async function preFetchAllNodeStats(): Promise<void> {
  if (isRunning) {
    console.log('⏸️  Pre-fetch already running, skipping...');
    return;
  }
  
  isRunning = true;
  const startTime = Date.now();
  
  try {
    const nodes = await getAllPNodes();
    const onlineNodes = nodes.filter(node => node.status === 'online');
    
    console.log(`🔄 Pre-fetching stats for ${onlineNodes.length} online nodes...`);
    
    if (onlineNodes.length === 0) {
      isRunning = false;
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let cachedCount = 0;

    // Process in batches to avoid overwhelming pRPC
    for (let i = 0; i < onlineNodes.length; i += BATCH_SIZE) {
      const batch = onlineNodes.slice(i, i + BATCH_SIZE);
      
      // Fetch stats for batch in parallel
      const promises = batch.map(async (node) => {
        try {
          // Check if already cached
          const cacheKey = `node_stats_${node.pubkey}`;
          const cached = await statsCacheService.get<any>(cacheKey);
          if (cached) {
            cachedCount++;
            return { success: true, cached: true, pubkey: node.pubkey };
          }
          
          // This will fetch from pRPC and cache in Redis
          const stats = await getNodeStatsByPubkey(node.pubkey);
          if (stats) {
            successCount++;
            return { success: true, cached: false, pubkey: node.pubkey };
          }
          failCount++;
          return { success: false, pubkey: node.pubkey };
        } catch (error) {
          failCount++;
          return { success: false, pubkey: node.pubkey };
        }
      });
      
      await Promise.allSettled(promises);
      
      // Small delay between batches
      if (i + BATCH_SIZE < onlineNodes.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Pre-fetch complete (${duration}s): ${successCount} fetched, ${cachedCount} from cache, ${failCount} failed`);
    console.log(`   📊 Total cached: ${successCount + cachedCount}/${onlineNodes.length} nodes (${((successCount + cachedCount) / onlineNodes.length * 100).toFixed(1)}%)`);
  } catch (error) {
    // Don't throw - this is a background job
    console.error('❌ Error in preFetchAllNodeStats:', error);
  } finally {
    isRunning = false;
  }
}

// Track last logged stats to avoid spam
let lastLoggedStats: { withRam: number; total: number; timestamp: number } | null = null;
const LOG_INTERVAL_MS = 10 * 1000; // Only log every 10 seconds

/**
 * Enrich all nodes with RAM data from Redis cache
 */
export async function enrichNodesWithCachedStats(nodes: PNode[]): Promise<PNode[]> {
  // Enrich nodes in parallel (all reads from Redis, very fast)
  const enrichedPromises = nodes.map(node => enrichNodeWithStats(node));
  const enriched = await Promise.all(enrichedPromises);
  
  // Log enrichment statistics (throttled to avoid spam)
  const withRam = enriched.filter(n => n.ramUsed !== undefined && n.ramTotal !== undefined).length;
  const withoutRam = enriched.length - withRam;
  const now = Date.now();
  
  // Only log if stats changed significantly or enough time has passed
  const shouldLog = !lastLoggedStats || 
    lastLoggedStats.withRam !== withRam || 
    lastLoggedStats.total !== enriched.length ||
    (now - lastLoggedStats.timestamp) > LOG_INTERVAL_MS;
  
  if (shouldLog) {
    console.log(`📊 RAM Enrichment: ${withRam}/${enriched.length} nodes have RAM data (${((withRam / enriched.length) * 100).toFixed(1)}%)`);
    if (withoutRam > 0) {
      console.log(`   ⚠️  ${withoutRam} nodes missing RAM data`);
    }
    lastLoggedStats = { withRam, total: enriched.length, timestamp: now };
  }
  
  return enriched;
}

/**
 * Start background stats enrichment job
 */
let enrichmentInterval: NodeJS.Timeout | null = null;

export function startStatsEnrichmentJob(): void {
  // Run immediately on start
  preFetchAllNodeStats();
  
  // Then run periodically
  enrichmentInterval = setInterval(() => {
    preFetchAllNodeStats();
  }, ENRICHMENT_INTERVAL_MS);
  
  console.log('✅ Stats enrichment job started (runs every 60s)');
}

/**
 * Stop background stats enrichment job
 */
export function stopStatsEnrichmentJob(): void {
  if (enrichmentInterval) {
    clearInterval(enrichmentInterval);
    enrichmentInterval = null;
    console.log('🔌 Stats enrichment job stopped');
  }
}

