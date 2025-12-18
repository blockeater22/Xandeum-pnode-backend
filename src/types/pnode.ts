export type PNodeStatus = "online" | "offline";

export type NetworkHealth = "healthy" | "degraded" | "unstable";

export interface PNode {
  pubkey: string;
  status: PNodeStatus;
  version: string;
  storageUsed: number;
  storageTotal: number;
  uptime: number;
  ip: string;
  lastSeen: string;
  // Additional Pod fields
  address?: string;
  isPublic?: boolean;
  rpcPort?: number;
  storageCommitted?: number;
  storageUsagePercent?: number;
  lastSeenTimestamp?: number;
  // RAM data (pre-fetched and cached in Redis)
  ramUsed?: number;
  ramTotal?: number;
}

export interface AnalyticsSummary {
  totalPNodes: number;
  onlinePNodes: number;
  onlinePercentage: number;
  averageUptime: number;
  totalStorageUsed: number;
  totalStorageCapacity: number;
  totalStorageUsedTB: number;
  totalStorageCapacityTB: number;
  networkHealth: NetworkHealth;
  consensusVersion: string; // Most common version used by nodes
}

export interface StorageAnalytics {
  pubkey: string;
  storageUsed: number;
  storageTotal: number;
  utilizationPercent: number;
}

export interface VersionDistribution {
  version: string;
  count: number;
}

/**
 * NodeStats from xandeum-prpc getStats() method
 * Represents detailed statistics for a specific pNode
 */
export interface NodeStats {
  active_streams: number;
  cpu_percent: number;
  current_index: number;
  file_size: number;
  last_updated: number;
  packets_received: number;
  packets_sent: number;
  ram_total: number;
  ram_used: number;
  total_bytes: number;
  total_pages: number;
  uptime: number;
  timestamp?: string; // ISO timestamp when stats were collected
}

/**
 * Extended analytics summary with advanced metrics
 */
export interface ExtendedSummary {
  totalPNodes: number;
  onlinePercentage: number;
  averageUptime24h: number;
  averageHealthScore: number;
  storagePressurePercent: number;
  networkHealth: NetworkHealth;
}

/**
 * Per-node metrics with derived analytics
 */
export interface NodeMetrics {
  pubkey: string;
  healthScore: number;
  uptime24h: number;
  storageUtilization: number;
  tier: "Excellent" | "Good" | "Poor";
}

/**
 * Top performing node
 */
export interface TopNode {
  pubkey: string;
  healthScore: number;
  uptime24h: number;
}

/**
 * Storage pressure metrics
 */
export interface StoragePressure {
  highPressureNodes: number;
  totalNodes: number;
  percent: number;
}

/**
 * Geographic location for a node
 */
export interface GeoLocation {
  lat: number;
  lng: number;
  country: string;
  region: string;
  city?: string;
}

/**
 * Map node data with geo and health information
 */
export interface MapNode {
  pubkey: string;
  lat: number;
  lng: number;
  country: string;
  region: string;
  status: PNodeStatus;
  healthScore: number;
  uptime24h: number;
  storageUtilization: number;
  version: string;
  lastSeen: string;
}

/**
 * Geographic summary analytics
 */
export interface GeoSummary {
  countries: Array<{ country: string; count: number }>;
  regions: Array<{ region: string; count: number }>;
}

