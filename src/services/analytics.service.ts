
import { getAllPNodes, getRawPodsForAnalytics } from "./pnode.service";
import { analyticsCacheService } from "./redis.service";
import { 
  calculateUtilization, 
  calculateUptime24h, 
  calculateHealthScore, 
  getNodeTier 
} from "../utils/format";
import {
  AnalyticsSummary,
  StorageAnalytics,
  VersionDistribution,
  NetworkHealth,
  ExtendedSummary,
  NodeMetrics,
  TopNode,
  StoragePressure,
  PNode,
} from "../types/pnode";
import { Pod } from "xandeum-prpc";

function calculateNetworkHealth(onlinePercentage: number): NetworkHealth {
  if (onlinePercentage >= 95) {
    return "healthy";
  } else if (onlinePercentage >= 85) {
    return "degraded";
  } else {
    return "unstable";
  }
}

const NODE_METRICS_CACHE_KEY = "computed_node_metrics";
const NODE_METRICS_CACHE_TTL_MS = 60 * 1000;

function computeNodeMetricsFromData(pods: Pod[], nodes: PNode[]): NodeMetrics[] {
  const metrics: NodeMetrics[] = [];
  
  // Debug mode: Enable via environment variable DEBUG_CALCULATIONS=true
  const DEBUG_MODE = process.env.DEBUG_CALCULATIONS === 'true';
  const debugLogs: Array<{
    pubkey: string;
    raw: {
      uptimeSeconds: number;
      storageUsed: number;
      storageCommitted: number;
      isOnline: boolean;
    };
    derived: {
      uptime24h: number;
      storageUtilization: number;
      healthScore: number;
      tier: string;
    };
    calculations: {
      uptime24hFormula: string;
      storageUtilFormula: string;
      healthScoreFormula: string;
    };
  }> = [];

  for (const pod of pods) {
    const node = nodes.find((n) => n.pubkey === pod.pubkey);
    if (!node || !pod.pubkey) continue;

    const uptimeSeconds = pod.uptime || 0;
    const uptime24h = calculateUptime24h(uptimeSeconds);

    const storageCommitted = pod.storage_committed || 0;
    const storageUsed = pod.storage_used || 0;
    const storageUtilization = storageCommitted > 0
      ? Math.round((storageUsed / storageCommitted) * 100 * 100) / 100
      : 0;

    const healthScore = calculateHealthScore(
      uptime24h,
      storageUtilization,
      node.status === "online"
    );
    
    if (DEBUG_MODE && debugLogs.length < 3) {
      const uptime24hCalc = `min((${uptimeSeconds} / 86400) * 100, 100) = ${uptime24h.toFixed(2)}%`;
      const storageUtilCalc = storageCommitted > 0
        ? `(${storageUsed} / ${storageCommitted}) * 100 = ${storageUtilization.toFixed(2)}%`
        : 'N/A (no storage_committed)';
      const healthScoreCalc = `(${uptime24h.toFixed(2)} * 0.5) + (${(100 - storageUtilization).toFixed(2)} * 0.3) + (${node.status === "online" ? 100 : 0} * 0.2) = ${healthScore.toFixed(2)}`;
      
      debugLogs.push({
        pubkey: pod.pubkey.substring(0, 16) + '...',
        raw: {
          uptimeSeconds,
          storageUsed,
          storageCommitted,
          isOnline: node.status === "online",
        },
        derived: {
          uptime24h,
          storageUtilization,
          healthScore,
          tier: getNodeTier(healthScore),
        },
        calculations: {
          uptime24hFormula: uptime24hCalc,
          storageUtilFormula: storageUtilCalc,
          healthScoreFormula: healthScoreCalc,
        },
      });
    }

    const tier = getNodeTier(healthScore);

    metrics.push({
      pubkey: pod.pubkey,
      healthScore,
      uptime24h,
      storageUtilization,
      tier,
    });
  }
  
  if (DEBUG_MODE && debugLogs.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 BACKEND CALCULATION DEBUG (Raw vs Derived Values)');
    console.log('='.repeat(80));
    debugLogs.forEach((log, index) => {
      console.log(`\n📦 Node #${index + 1} (${log.pubkey}):`);
      console.log('   RAW VALUES (from pRPC):');
      console.log(`      uptimeSeconds: ${log.raw.uptimeSeconds}`);
      console.log(`      storageUsed: ${log.raw.storageUsed} bytes (${(log.raw.storageUsed / (1024 ** 3)).toFixed(2)} GB)`);
      console.log(`      storageCommitted: ${log.raw.storageCommitted} bytes (${(log.raw.storageCommitted / (1024 ** 3)).toFixed(2)} GB)`);
      console.log(`      isOnline: ${log.raw.isOnline}`);
      console.log('   DERIVED VALUES (computed by backend):');
      console.log(`      uptime24h: ${log.derived.uptime24h.toFixed(2)}%`);
      console.log(`      storageUtilization: ${log.derived.storageUtilization.toFixed(2)}%`);
      console.log(`      healthScore: ${log.derived.healthScore.toFixed(2)}`);
      console.log(`      tier: ${log.derived.tier}`);
      console.log('   CALCULATIONS:');
      console.log(`      ${log.calculations.uptime24hFormula}`);
      console.log(`      ${log.calculations.storageUtilFormula}`);
      console.log(`      ${log.calculations.healthScoreFormula}`);
    });
    console.log('\n' + '='.repeat(80) + '\n');
  }

  return metrics;
}

export async function getCachedNodeMetrics(): Promise<NodeMetrics[]> {
  const cached = await analyticsCacheService.get<NodeMetrics[]>(NODE_METRICS_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const [pods, nodes] = await Promise.all([
    getRawPodsForAnalytics(),
    getAllPNodes(),
  ]);

  const metrics = computeNodeMetricsFromData(pods, nodes);
  await analyticsCacheService.set(NODE_METRICS_CACHE_KEY, metrics, NODE_METRICS_CACHE_TTL_MS);

  return metrics;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const nodes = await getAllPNodes();
  
  // Get raw pods data directly from pRPC (matching official website calculation)
  const rawPods = await getRawPodsForAnalytics();

  const totalPNodes = nodes.length;
  const onlineNodes = nodes.filter((n) => n.status === "online");
  const onlinePNodes = onlineNodes.length;
  const onlinePercentage = totalPNodes > 0 
    ? Math.round((onlinePNodes / totalPNodes) * 100 * 100) / 100 
    : 0;

  const uptimes = onlineNodes.map((n) => n.uptime).filter((u) => u > 0);
  const averageUptime = uptimes.length > 0
    ? Math.round((uptimes.reduce((sum, u) => sum + u, 0) / uptimes.length) * 100) / 100 
    : 0;

  // Calculate storage for ALL nodes (not just online)
  const totalStorageUsed = nodes.reduce((sum, n) => {
    return sum + (n.storageUsed || 0);
  }, 0);
  
  // Calculate total committed storage using RAW pRPC data (matching official website)
  // Official website uses raw storage_committed from pRPC directly, not normalized data
  let nodesWithCommitted = 0;
  let nodesWithoutCommitted = 0;
  let totalStorageCapacityFromNodes = 0;
  let totalStorageCapacityFromRawPods = 0;
  
  // Method 1: From normalized nodes
  totalStorageCapacityFromNodes = nodes.reduce((sum, n) => {
    if (n.storageCommitted && n.storageCommitted > 0) {
      nodesWithCommitted++;
      return sum + n.storageCommitted;
    } else {
      nodesWithoutCommitted++;
      return sum;
    }
  }, 0);
  
  // Method 2: From raw pods (official website method)
  let rawPodsWithCommitted = 0;
  let rawPodsWithoutCommitted = 0;
  totalStorageCapacityFromRawPods = rawPods.reduce((sum, pod) => {
    if (pod.storage_committed && pod.storage_committed > 0) {
      rawPodsWithCommitted++;
      return sum + pod.storage_committed;
    } else {
      rawPodsWithoutCommitted++;
      return sum;
    }
  }, 0);
  
  // Use raw pods calculation (matching official website)
  const totalStorageCapacity = totalStorageCapacityFromRawPods;
  
  const totalStorageUsedTB = totalStorageUsed / (1024 ** 4);
  const totalStorageCapacityTB = totalStorageCapacity / (1024 ** 4);

  const versionMap = new Map<string, number>();
  for (const node of nodes) {
    const version = node.version || "unknown";
    versionMap.set(version, (versionMap.get(version) || 0) + 1);
  }
  
  // Find the version with the highest count
  let consensusVersion = "unknown";
  let maxCount = 0;
  for (const [version, count] of versionMap.entries()) {
    if (count > maxCount) {
      maxCount = count;
      consensusVersion = version;
    }
  }

  const networkHealth = calculateNetworkHealth(onlinePercentage);

  return {
    totalPNodes,
    onlinePNodes,
    onlinePercentage,
    averageUptime,
    totalStorageUsed,
    totalStorageCapacity,
    totalStorageUsedTB,
    totalStorageCapacityTB,
    networkHealth,
    consensusVersion,
  };
}

export async function getStorageAnalytics(): Promise<StorageAnalytics[]> {
  const nodes = await getAllPNodes();

  return nodes.map((node) => ({
    pubkey: node.pubkey,
    storageUsed: node.storageUsed,
    storageTotal: node.storageTotal,
    utilizationPercent: calculateUtilization(node.storageUsed, node.storageTotal),
  }));
}

export async function getVersionDistribution(): Promise<VersionDistribution[]> {
  const nodes = await getAllPNodes();
  const versionMap = new Map<string, number>();
  
  for (const node of nodes) {
    const version = node.version || "unknown";
    versionMap.set(version, (versionMap.get(version) || 0) + 1);
  }

  return Array.from(versionMap.entries())
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getExtendedSummary(): Promise<ExtendedSummary> {
  const metrics = await getCachedNodeMetrics();
  const nodes = await getAllPNodes();

  const totalPNodes = metrics.length;
  if (totalPNodes === 0) {
    return {
      totalPNodes: 0,
      onlinePercentage: 0,
      averageUptime24h: 0,
      averageHealthScore: 0,
      storagePressurePercent: 0,
      networkHealth: "unstable",
    };
  }

  const onlineNodes = nodes.filter((n) => n.status === "online");
  const onlinePercentage = Math.round((onlineNodes.length / totalPNodes) * 100 * 100) / 100;

  const averageUptime24h = metrics.length > 0
    ? Math.round((metrics.reduce((sum, m) => sum + m.uptime24h, 0) / metrics.length) * 100) / 100
    : 0;

  const averageHealthScore = metrics.length > 0
    ? Math.round((metrics.reduce((sum, m) => sum + m.healthScore, 0) / metrics.length) * 100) / 100
    : 0;

  const highPressureNodes = metrics.filter((m) => m.storageUtilization > 80).length;
  const storagePressurePercent = Math.round((highPressureNodes / totalPNodes) * 100 * 100) / 100;

  const networkHealth = calculateNetworkHealth(onlinePercentage);

  return {
    totalPNodes,
    onlinePercentage,
    averageUptime24h,
    averageHealthScore,
    storagePressurePercent,
    networkHealth,
  };
}

export async function getNodeMetrics(): Promise<NodeMetrics[]> {
  return getCachedNodeMetrics();
}

export async function getTopNodes(): Promise<TopNode[]> {
  const metrics = await getCachedNodeMetrics();

  return metrics
    .sort((a, b) => b.healthScore - a.healthScore)
    .slice(0, 10)
    .map((m) => ({
      pubkey: m.pubkey,
      healthScore: m.healthScore,
      uptime24h: m.uptime24h,
    }));
}

export async function getStoragePressure(): Promise<StoragePressure> {
  const metrics = await getCachedNodeMetrics();
  const totalNodes = metrics.length;
  const highPressureNodes = metrics.filter((m) => m.storageUtilization > 80).length;
  
  const percent = totalNodes > 0
    ? Math.round((highPressureNodes / totalNodes) * 100 * 100) / 100
    : 0;

  return {
    highPressureNodes,
    totalNodes,
    percent,
  };
}

