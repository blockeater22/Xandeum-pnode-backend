import { PNode } from "../types/pnode";
import { Pod } from "xandeum-prpc";

const ONLINE_THRESHOLD_SECONDS = Number(process.env.ONLINE_THRESHOLD_SECONDS) || 300;

export function normalizePNode(pod: Pod): PNode {
  const thresholdTime = Math.floor(Date.now() / 1000) - ONLINE_THRESHOLD_SECONDS;
  const isOnline = pod.last_seen_timestamp >= thresholdTime;
  
  let storageTotal = 0;
  if (pod.storage_committed) {
    storageTotal = pod.storage_committed;
  } else if (pod.storage_used && pod.storage_usage_percent) {
    if (pod.storage_usage_percent > 0 && pod.storage_usage_percent <= 100) {
      storageTotal = Math.round((pod.storage_used * 100) / pod.storage_usage_percent);
    }
  }
  
  const lastSeenDate = new Date(pod.last_seen_timestamp * 1000);
  const lastSeen = lastSeenDate.toISOString();
  
  const rawUptime = pod.uptime || 0;
  let uptime30dNormalized = rawUptime;
  if (uptime30dNormalized > 100) {
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    uptime30dNormalized = Math.min(100, (uptime30dNormalized / thirtyDaysInSeconds) * 100);
  } else if (uptime30dNormalized < 0) {
    uptime30dNormalized = 0;
  }
  
  const normalized: PNode = {
    pubkey: pod.pubkey || "",
    status: isOnline ? "online" : "offline",
    version: pod.version || "unknown",
    storageUsed: pod.storage_used || 0,
    storageTotal: storageTotal, 
    uptime: uptime30dNormalized,
    ip: pod.address || "",
    lastSeen: lastSeen,
    address: pod.address,
    isPublic: pod.is_public,
    rpcPort: pod.rpc_port,
    storageCommitted: pod.storage_committed,
    storageUsagePercent: pod.storage_usage_percent,
    lastSeenTimestamp: pod.last_seen_timestamp,
  };
  
  return normalized;
}

export function calculateUtilization(storageUsed: number, storageTotal: number): number {
  if (storageTotal === 0) return 0;
  return Math.round((storageUsed / storageTotal) * 100 * 100) / 100;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0 || bytes < 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  
  const i = bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(k)) : 0;
  const unitIndex = Math.min(i, sizes.length - 1);
  const value = bytes / Math.pow(k, unitIndex);
  
  let decimals = 2;
  if (unitIndex === 0) decimals = 0;
  else if (unitIndex <= 2) decimals = 1;
  else decimals = 2;
  
  return value.toFixed(decimals) + " " + sizes[unitIndex];
}

export function formatUptimeHuman(uptimeSeconds: number): string {
  if (uptimeSeconds < 0) return "0m";
  if (uptimeSeconds === 0) return "0m";
  
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  
  return parts.join(" ");
}

export function calculateUptime24h(uptimeSeconds: number): number {
  if (uptimeSeconds < 0) return 0;
  const secondsIn24h = 86400;
  const percentage = (uptimeSeconds / secondsIn24h) * 100;
  return Math.min(100, Math.max(0, percentage));
}

export function calculateHealthScore(
  uptime24h: number,
  storageUtilization: number,
  isOnline: boolean
): number {
  const uptimeScore = uptime24h * 0.5;
  const clampedUtilization = Math.min(100, Math.max(0, storageUtilization));
  const storageScore = (100 - clampedUtilization) * 0.3;
  const onlineScore = isOnline ? 100 : 0;
  const onlineScoreWeighted = onlineScore * 0.2;
  
  const totalScore = uptimeScore + storageScore + onlineScoreWeighted;
  return Math.round(Math.min(100, Math.max(0, totalScore)) * 100) / 100;
}

export type NodeTier = "Excellent" | "Good" | "Poor";

export function getNodeTier(healthScore: number): NodeTier {
  if (healthScore >= 90) return "Excellent";
  if (healthScore >= 75) return "Good";
  return "Poor";
}

