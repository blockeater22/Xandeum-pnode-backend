/**
 * Direct pRPC Source Verification Script
 * 
 * This script queries pRPC directly (bypassing backend) to verify ground truth data.
 * Run: npx tsx scripts/verify-prpc-source.ts
 */

import { PrpcClient } from "xandeum-prpc";

const SEED_IP = "173.212.220.65";

async function verifyPRPCSource() {
  console.log("🔍 Querying pRPC directly for source data verification...\n");
  
  try {
    const client = new PrpcClient(SEED_IP, { timeout: 10000 });
    
    // Try getPodsWithStats first (more complete data)
    let response;
    try {
      console.log("📊 Attempting getPodsWithStats()...");
      response = await client.getPodsWithStats();
      console.log("✅ Successfully fetched with getPodsWithStats()\n");
    } catch (error) {
      console.log("⚠️ getPodsWithStats() failed, trying getPods()...");
      response = await client.getPods();
      console.log("✅ Successfully fetched with getPods()\n");
    }
    
    const pods = response.pods || [];
    console.log(`📦 Total pods received: ${pods.length}\n`);
    
    if (pods.length === 0) {
      console.error("❌ No pods received from pRPC!");
      return;
    }
    
    // Analyze first 5 pods in detail
    console.log("=".repeat(80));
    console.log("DETAILED ANALYSIS OF FIRST 5 PODS (Ground Truth Data)");
    console.log("=".repeat(80));
    
    pods.slice(0, 5).forEach((pod, index) => {
      console.log(`\n📦 Pod #${index + 1}:`);
      console.log(`   Pubkey: ${pod.pubkey?.substring(0, 16)}...`);
      console.log(`   Version: ${pod.version || 'N/A'}`);
      console.log(`   Address: ${pod.address || 'N/A'}`);
      console.log(`   Is Public: ${pod.is_public || false}`);
      console.log(`   RPC Port: ${pod.rpc_port || 'N/A'}`);
      console.log(`\n   ⏱️  UPTIME (Raw from pRPC):`);
      console.log(`      uptime: ${pod.uptime || 0} seconds`);
      console.log(`      uptime hours: ${((pod.uptime || 0) / 3600).toFixed(2)}`);
      console.log(`      uptime days: ${((pod.uptime || 0) / 86400).toFixed(2)}`);
      console.log(`      Expected uptime24h%: ${Math.min(((pod.uptime || 0) / 86400) * 100, 100).toFixed(2)}%`);
      console.log(`\n   💾 STORAGE (Raw from pRPC):`);
      console.log(`      storage_used: ${pod.storage_used || 0} bytes`);
      console.log(`      storage_used GB: ${((pod.storage_used || 0) / (1024 ** 3)).toFixed(2)}`);
      console.log(`      storage_committed: ${pod.storage_committed || 0} bytes`);
      console.log(`      storage_committed GB: ${((pod.storage_committed || 0) / (1024 ** 3)).toFixed(2)}`);
      console.log(`      storage_committed TB: ${((pod.storage_committed || 0) / (1024 ** 4)).toFixed(2)}`);
      console.log(`      storage_usage_percent: ${pod.storage_usage_percent || 'N/A'}`);
      if (pod.storage_committed && pod.storage_used) {
        const calcUtil = ((pod.storage_used / pod.storage_committed) * 100).toFixed(2);
        console.log(`      Calculated utilization%: ${calcUtil}%`);
      }
      console.log(`\n   🕐 LAST SEEN:`);
      console.log(`      last_seen_timestamp: ${pod.last_seen_timestamp || 'N/A'}`);
      if (pod.last_seen_timestamp) {
        const lastSeenDate = new Date(pod.last_seen_timestamp * 1000);
        const now = Date.now();
        const secondsAgo = Math.floor((now - lastSeenDate.getTime()) / 1000);
        const isOnline = secondsAgo < 300; // 5 minutes
        console.log(`      last_seen_date: ${lastSeenDate.toISOString()}`);
        console.log(`      seconds_ago: ${secondsAgo}`);
        console.log(`      status (5min threshold): ${isOnline ? 'online' : 'offline'}`);
      }
    });
    
    // Summary statistics
    console.log("\n" + "=".repeat(80));
    console.log("SUMMARY STATISTICS");
    console.log("=".repeat(80));
    
    const podsWithUptime = pods.filter(p => p.uptime && p.uptime > 0);
    const podsWithStorage = pods.filter(p => p.storage_committed && p.storage_committed > 0);
    const podsWithVersion = pods.filter(p => p.version);
    
    const totalUptimeSeconds = podsWithUptime.reduce((sum, p) => sum + (p.uptime || 0), 0);
    const avgUptimeSeconds = podsWithUptime.length > 0 ? totalUptimeSeconds / podsWithUptime.length : 0;
    const avgUptime24h = Math.min((avgUptimeSeconds / 86400) * 100, 100);
    
    const totalStorageUsed = pods.reduce((sum, p) => sum + (p.storage_used || 0), 0);
    const totalStorageCommitted = pods.reduce((sum, p) => sum + (p.storage_committed || 0), 0);
    
    console.log(`\n📊 Pod Statistics:`);
    console.log(`   Total pods: ${pods.length}`);
    console.log(`   Pods with uptime: ${podsWithUptime.length}`);
    console.log(`   Pods with storage: ${podsWithStorage.length}`);
    console.log(`   Pods with version: ${podsWithVersion.length}`);
    console.log(`\n⏱️  Uptime Statistics:`);
    console.log(`   Average uptime (seconds): ${avgUptimeSeconds.toFixed(2)}`);
    console.log(`   Average uptime (hours): ${(avgUptimeSeconds / 3600).toFixed(2)}`);
    console.log(`   Average uptime (days): ${(avgUptimeSeconds / 86400).toFixed(2)}`);
    console.log(`   Average uptime24h%: ${avgUptime24h.toFixed(2)}%`);
    console.log(`\n💾 Storage Statistics:`);
    console.log(`   Total storage used: ${(totalStorageUsed / (1024 ** 3)).toFixed(2)} GB`);
    console.log(`   Total storage used: ${(totalStorageUsed / (1024 ** 4)).toFixed(2)} TB`);
    console.log(`   Total storage committed: ${(totalStorageCommitted / (1024 ** 3)).toFixed(2)} GB`);
    console.log(`   Total storage committed: ${(totalStorageCommitted / (1024 ** 4)).toFixed(2)} TB`);
    
    // Version distribution
    const versionMap = new Map<string, number>();
    pods.forEach(p => {
      const version = p.version || 'unknown';
      versionMap.set(version, (versionMap.get(version) || 0) + 1);
    });
    console.log(`\n📦 Version Distribution:`);
    Array.from(versionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([version, count]) => {
        console.log(`   ${version}: ${count} nodes`);
      });
    
    // Save sample to file for reference
    const sample = pods.slice(0, 3).map(p => ({
      pubkey: p.pubkey,
      version: p.version,
      uptime: p.uptime,
      storage_used: p.storage_used,
      storage_committed: p.storage_committed,
      storage_usage_percent: p.storage_usage_percent,
      last_seen_timestamp: p.last_seen_timestamp,
      address: p.address,
    }));
    
    console.log("\n" + "=".repeat(80));
    console.log("✅ Source data verification complete!");
    console.log("=".repeat(80));
    console.log("\n💾 Sample data (first 3 pods):");
    console.log(JSON.stringify(sample, null, 2));
    
  } catch (error) {
    console.error("❌ Error querying pRPC:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    }
  }
}

// Run verification
verifyPRPCSource().catch(console.error);

