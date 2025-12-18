/**
 * API Response Validation Script
 * 
 * This script validates API responses by cross-checking:
 * - Total counts match across endpoints
 * - Percentages add up correctly
 * - Derived values are consistent
 * 
 * Run: npx tsx scripts/validate-api-responses.ts
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

async function fetchJSON<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }
  return response.json();
}

async function validateAPIResponses() {
  console.log("🔍 Validating API Responses...\n");
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  const results: ValidationResult[] = [];

  try {
    // 1. Fetch all data
    const [pnodes, summary, extendedSummary, nodeMetrics, storagePressure] = await Promise.all([
      fetchJSON<any[]>('/pnodes'),
      fetchJSON<any>('/analytics/summary'),
      fetchJSON<any>('/analytics/extended-summary'),
      fetchJSON<any[]>('/analytics/node-metrics'),
      fetchJSON<any>('/analytics/storage-pressure'),
    ]);

    console.log("=".repeat(80));
    console.log("VALIDATION RESULTS");
    console.log("=".repeat(80));

    // Validation 1: Total node count consistency
    console.log("\n✅ Validation 1: Total Node Count Consistency");
    const totalNodesFromPNodes = pnodes.length;
    const totalNodesFromSummary = summary.totalPNodes; // Fixed: use totalPNodes
    
    if (totalNodesFromPNodes === totalNodesFromSummary) {
      results.push({ passed: true, message: `Total nodes match: ${totalNodesFromPNodes}` });
      console.log(`   ✓ Total nodes match: ${totalNodesFromPNodes}`);
    } else {
      results.push({
        passed: false,
        message: `Total nodes mismatch: /pnodes=${totalNodesFromPNodes}, /analytics/summary=${totalNodesFromSummary}`,
      });
      console.log(`   ✗ MISMATCH: /pnodes=${totalNodesFromPNodes}, /analytics/summary=${totalNodesFromSummary}`);
    }

    // Validation 2: Online/Offline counts
    console.log("\n✅ Validation 2: Online/Offline Counts");
    const onlineFromPNodes = pnodes.filter(n => n.status === 'online').length;
    const offlineFromPNodes = pnodes.filter(n => n.status === 'offline').length;
    const onlineFromSummary = summary.onlinePNodes; // Fixed: use onlinePNodes
    
    if (onlineFromPNodes === onlineFromSummary) {
      results.push({ passed: true, message: `Online nodes match: ${onlineFromPNodes}` });
      console.log(`   ✓ Online nodes match: ${onlineFromPNodes}`);
    } else {
      results.push({
        passed: false,
        message: `Online nodes mismatch: /pnodes=${onlineFromPNodes}, /analytics/summary=${onlineFromSummary}`,
      });
      console.log(`   ✗ MISMATCH: /pnodes=${onlineFromPNodes}, /analytics/summary=${onlineFromSummary}`);
    }
    
    console.log(`   Online: ${onlineFromPNodes}, Offline: ${offlineFromPNodes}, Total: ${onlineFromPNodes + offlineFromPNodes}`);
    
    if (onlineFromPNodes + offlineFromPNodes === totalNodesFromPNodes) {
      results.push({ passed: true, message: 'Online + Offline = Total' });
      console.log(`   ✓ Online + Offline = Total`);
    } else {
      results.push({
        passed: false,
        message: `Online + Offline (${onlineFromPNodes + offlineFromPNodes}) ≠ Total (${totalNodesFromPNodes})`,
      });
      console.log(`   ✗ MISMATCH: Online + Offline (${onlineFromPNodes + offlineFromPNodes}) ≠ Total (${totalNodesFromPNodes})`);
    }

    // Validation 3: Online percentage calculation
    console.log("\n✅ Validation 3: Online Percentage Calculation");
    const calculatedOnlinePercent = totalNodesFromPNodes > 0
      ? Math.round((onlineFromPNodes / totalNodesFromPNodes) * 100 * 100) / 100
      : 0;
    const apiOnlinePercent = summary.onlinePercentage;
    
    if (Math.abs(calculatedOnlinePercent - apiOnlinePercent) < 0.01) {
      results.push({ passed: true, message: `Online percentage matches: ${apiOnlinePercent}%` });
      console.log(`   ✓ Online percentage matches: ${apiOnlinePercent}%`);
    } else {
      results.push({
        passed: false,
        message: `Online percentage mismatch: calculated=${calculatedOnlinePercent}%, API=${apiOnlinePercent}%`,
      });
      console.log(`   ✗ MISMATCH: calculated=${calculatedOnlinePercent}%, API=${apiOnlinePercent}%`);
    }

    // Validation 4: Node metrics count
    console.log("\n✅ Validation 4: Node Metrics Count");
    const metricsCount = nodeMetrics.length;
    
    if (metricsCount === totalNodesFromPNodes) {
      results.push({ passed: true, message: `Node metrics count matches: ${metricsCount}` });
      console.log(`   ✓ Node metrics count matches: ${metricsCount}`);
    } else {
      results.push({
        passed: false,
        message: `Node metrics count mismatch: expected=${totalNodesFromPNodes}, actual=${metricsCount}`,
      });
      console.log(`   ✗ MISMATCH: expected=${totalNodesFromPNodes}, actual=${metricsCount}`);
    }

    // Validation 5: Tier distribution adds up
    console.log("\n✅ Validation 5: Tier Distribution");
    const excellentCount = nodeMetrics.filter(m => m.tier === 'Excellent').length;
    const goodCount = nodeMetrics.filter(m => m.tier === 'Good').length;
    const poorCount = nodeMetrics.filter(m => m.tier === 'Poor').length;
    const totalTiers = excellentCount + goodCount + poorCount;
    
    console.log(`   Excellent: ${excellentCount}`);
    console.log(`   Good: ${goodCount}`);
    console.log(`   Poor: ${poorCount}`);
    console.log(`   Total: ${totalTiers}`);
    
    if (totalTiers === totalNodesFromPNodes) {
      results.push({ passed: true, message: 'Tier distribution adds up correctly' });
      console.log(`   ✓ Tier distribution adds up correctly`);
    } else {
      results.push({
        passed: false,
        message: `Tier distribution mismatch: ${totalTiers} ≠ ${totalNodesFromPNodes}`,
      });
      console.log(`   ✗ MISMATCH: ${totalTiers} ≠ ${totalNodesFromPNodes}`);
    }

    // Validation 6: Storage pressure calculation
    console.log("\n✅ Validation 6: Storage Pressure");
    const highPressureNodes = nodeMetrics.filter(m => m.storageUtilization > 80).length;
    const apiHighPressure = storagePressure.highPressureNodes;
    
    if (highPressureNodes === apiHighPressure) {
      results.push({ passed: true, message: `High pressure nodes match: ${highPressureNodes}` });
      console.log(`   ✓ High pressure nodes match: ${highPressureNodes}`);
    } else {
      results.push({
        passed: false,
        message: `High pressure nodes mismatch: calculated=${highPressureNodes}, API=${apiHighPressure}`,
      });
      console.log(`   ✗ MISMATCH: calculated=${highPressureNodes}, API=${apiHighPressure}`);
    }

    // Validation 7: Extended summary consistency
    console.log("\n✅ Validation 7: Extended Summary Consistency");
    const extTotalNodes = extendedSummary.totalPNodes;
    const extOnlinePercent = extendedSummary.onlinePercentage;
    
    if (extTotalNodes === totalNodesFromPNodes) {
      results.push({ passed: true, message: 'Extended summary total nodes match' });
      console.log(`   ✓ Extended summary total nodes match: ${extTotalNodes}`);
    } else {
      results.push({
        passed: false,
        message: `Extended summary total nodes mismatch: ${extTotalNodes} ≠ ${totalNodesFromPNodes}`,
      });
      console.log(`   ✗ MISMATCH: ${extTotalNodes} ≠ ${totalNodesFromPNodes}`);
    }
    
    if (Math.abs(extOnlinePercent - apiOnlinePercent) < 0.01) {
      results.push({ passed: true, message: 'Extended summary online percentage matches' });
      console.log(`   ✓ Extended summary online percentage matches: ${extOnlinePercent}%`);
    } else {
      results.push({
        passed: false,
        message: `Extended summary online percentage mismatch: ${extOnlinePercent}% ≠ ${apiOnlinePercent}%`,
      });
      console.log(`   ✗ MISMATCH: ${extOnlinePercent}% ≠ ${apiOnlinePercent}%`);
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("VALIDATION SUMMARY");
    console.log("=".repeat(80));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${results.length}`);
    
    if (failed > 0) {
      console.log("\n❌ Failed Validations:");
      results.filter(r => !r.passed).forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.message}`);
      });
    }
    
    console.log("\n" + "=".repeat(80));
    
    if (failed === 0) {
      console.log("✅ All validations passed!");
      process.exit(0);
    } else {
      console.log("❌ Some validations failed. Please review the errors above.");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Error during validation:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    }
    process.exit(1);
  }
}

// Run validation
validateAPIResponses();

