/**
 * Map Service
 * 
 * Provides map-specific data combining pNode information with geographic data.
 * Reuses cached pNode and metrics data for efficiency.
 */

import { getAllPNodes } from "./pnode.service";
import { getCachedNodeMetrics } from "./analytics.service";
import { resolveNodeGeo } from "./geo.service";
import { MapNode, GeoSummary } from "../types/pnode";

/**
 * Get all pNodes with geographic and health data for map visualization.
 * 
 * This function:
 * - Reuses cached pNode data (30s TTL)
 * - Reuses cached node metrics (60s TTL)
 * - Resolves geo data with 24h cache
 * - Never blocks on geo failures (continues with available data)
 * - Limits concurrent geo lookups to avoid rate limits
 * - Uses timeouts to prevent slow responses
 * 
 * @returns Array of MapNode objects with geo and health data
 */
export async function getMapNodes(): Promise<MapNode[]> {
  try {
    // Reuse cached data
    const [nodes, metrics] = await Promise.all([
      getAllPNodes(),
      getCachedNodeMetrics(),
    ]);

    // Create metrics map for quick lookup
    const metricsMap = new Map(metrics.map(m => [m.pubkey, m]));

    // Optimized geo lookups: Most will be cached (Redis/in-memory), so we can process all in parallel
    // Only batch if we have many uncached nodes to respect API rate limits
    const BATCH_SIZE = 20; // Larger batch size since most are cached
    const GEO_TIMEOUT_MS = 2000; // Reduced timeout since cached lookups are instant

    const mapNodes: MapNode[] = [];
    
    // Process all nodes in parallel - cached lookups are instant
    // Only batch if we have a very large number of nodes
    if (nodes.length > 100) {
      // For large datasets, process in batches but without delays (cached lookups are fast)
      for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
        const batch = nodes.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (node) => {
          try {
            const geo = await resolveNodeGeo(node.address || node.ip, GEO_TIMEOUT_MS);
            const nodeMetrics = metricsMap.get(node.pubkey);
            
            if (!geo) return null;

            return {
              pubkey: node.pubkey,
              lat: geo.lat,
              lng: geo.lng,
              country: geo.country,
              region: geo.region,
              status: node.status,
              healthScore: nodeMetrics?.healthScore ?? 0,
              uptime24h: nodeMetrics?.uptime24h ?? 0,
              storageUtilization: nodeMetrics?.storageUtilization ?? 0,
              version: node.version,
              lastSeen: node.lastSeen,
            } as MapNode;
          } catch (error) {
            return null;
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value !== null) {
            mapNodes.push(result.value);
          }
        }
      }
    } else {
      // For smaller datasets, process all in parallel (most will be cached)
      const allPromises = nodes.map(async (node) => {
        try {
          const geo = await resolveNodeGeo(node.address || node.ip, GEO_TIMEOUT_MS);
          const nodeMetrics = metricsMap.get(node.pubkey);
          
          if (!geo) return null;

          return {
            pubkey: node.pubkey,
            lat: geo.lat,
            lng: geo.lng,
            country: geo.country,
            region: geo.region,
            status: node.status,
            healthScore: nodeMetrics?.healthScore ?? 0,
            uptime24h: nodeMetrics?.uptime24h ?? 0,
            storageUtilization: nodeMetrics?.storageUtilization ?? 0,
            version: node.version,
            lastSeen: node.lastSeen,
          } as MapNode;
        } catch (error) {
          return null;
        }
      });

      const allResults = await Promise.allSettled(allPromises);
      for (const result of allResults) {
        if (result.status === 'fulfilled' && result.value !== null) {
          mapNodes.push(result.value);
        }
      }
    }

    return mapNodes;
  } catch (error) {
    console.error("❌ Error in getMapNodes:", error);
    throw error; // Re-throw to be handled by route handler
  }
}

/**
 * Get geographic summary analytics.
 * 
 * @returns Summary of nodes by country and region
 */
export async function getGeoSummary(): Promise<GeoSummary> {
  const mapNodes = await getMapNodes();

  // Count by country
  const countryMap = new Map<string, number>();
  for (const node of mapNodes) {
    countryMap.set(node.country, (countryMap.get(node.country) || 0) + 1);
  }

  // Count by region
  const regionMap = new Map<string, number>();
  for (const node of mapNodes) {
    regionMap.set(node.region, (regionMap.get(node.region) || 0) + 1);
  }

  const countries = Array.from(countryMap.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  const regions = Array.from(regionMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);

  return {
    countries,
    regions,
  };
}

