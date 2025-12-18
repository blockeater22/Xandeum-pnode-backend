import { PrpcClient } from "xandeum-prpc";

/**
 * Seed IPs for pRPC gossip discovery
 */
export const SEED_IPS = [
  "173.212.220.65",
  "161.97.97.41",
  "192.190.136.36",
  "192.190.136.38",
  "207.244.255.1",
  "192.190.136.28",
  "192.190.136.29",
  "173.212.203.145",
];

/**
 * Initialize and configure pRPC client
 * Uses the first seed IP as the primary connection point
 */
export function createPrpcClient(): PrpcClient {
  try {
    // PrpcClient constructor takes a single IP address
    const client = new PrpcClient(SEED_IPS[0], {
      timeout: 10000, // 10 second timeout
    });

    return client;
  } catch (error) {
    throw new Error(`Failed to initialize pRPC client: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const prpcClient = createPrpcClient();

