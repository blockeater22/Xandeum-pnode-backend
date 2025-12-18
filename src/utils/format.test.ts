/**
 * Unit Tests for Calculation Functions
 * 
 * Run: npm test -- format.test.ts
 * 
 * These tests validate the mathematical correctness of our calculation functions.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateUptime24h,
  calculateHealthScore,
  getNodeTier,
  calculateUtilization,
} from './format';

describe('calculateUptime24h', () => {
  it('should convert 12 hours (43200 seconds) to 50%', () => {
    expect(calculateUptime24h(43200)).toBe(50);
  });

  it('should convert 24 hours (86400 seconds) to 100%', () => {
    expect(calculateUptime24h(86400)).toBe(100);
  });

  it('should cap at 100% for uptime exceeding 24 hours', () => {
    expect(calculateUptime24h(172800)).toBe(100); // 48 hours
    expect(calculateUptime24h(259200)).toBe(100); // 72 hours
  });

  it('should return 0 for negative uptime', () => {
    expect(calculateUptime24h(-100)).toBe(0);
  });

  it('should return 0 for zero uptime', () => {
    expect(calculateUptime24h(0)).toBe(0);
  });

  it('should handle fractional hours correctly', () => {
    // 6 hours = 21600 seconds = 25%
    expect(calculateUptime24h(21600)).toBe(25);
    // 18 hours = 64800 seconds = 75%
    expect(calculateUptime24h(64800)).toBe(75);
  });
});

describe('calculateHealthScore', () => {
  it('should calculate perfect score for ideal node', () => {
    // 100% uptime24h, 0% storage utilization, online
    // (100 * 0.5) + ((100 - 0) * 0.3) + (100 * 0.2) = 50 + 30 + 20 = 100
    expect(calculateHealthScore(100, 0, true)).toBe(100);
  });

  it('should calculate score for offline node', () => {
    // 100% uptime24h, 0% storage utilization, offline
    // (100 * 0.5) + ((100 - 0) * 0.3) + (0 * 0.2) = 50 + 30 + 0 = 80
    expect(calculateHealthScore(100, 0, false)).toBe(80);
  });

  it('should calculate score with partial uptime', () => {
    // 50% uptime24h, 20% storage utilization, online
    // (50 * 0.5) + ((100 - 20) * 0.3) + (100 * 0.2) = 25 + 24 + 20 = 69
    expect(calculateHealthScore(50, 20, true)).toBe(69);
  });

  it('should handle high storage utilization', () => {
    // 100% uptime24h, 80% storage utilization, online
    // (100 * 0.5) + ((100 - 80) * 0.3) + (100 * 0.2) = 50 + 6 + 20 = 76
    expect(calculateHealthScore(100, 80, true)).toBe(76);
  });

  it('should handle 100% storage utilization', () => {
    // 100% uptime24h, 100% storage utilization, online
    // (100 * 0.5) + ((100 - 100) * 0.3) + (100 * 0.2) = 50 + 0 + 20 = 70
    expect(calculateHealthScore(100, 100, true)).toBe(70);
  });

  it('should clamp storage utilization to 0-100 range', () => {
    // Negative utilization should be treated as 0
    expect(calculateHealthScore(100, -10, true)).toBe(100);
    // Over 100% should be treated as 100
    expect(calculateHealthScore(100, 150, true)).toBe(70);
  });

  it('should clamp final score to 0-100 range', () => {
    // Even with extreme values, score should be clamped
    expect(calculateHealthScore(200, -50, true)).toBe(100);
    expect(calculateHealthScore(-100, 200, false)).toBe(0);
  });
});

describe('getNodeTier', () => {
  it('should return Excellent for scores >= 90', () => {
    expect(getNodeTier(90)).toBe('Excellent');
    expect(getNodeTier(95)).toBe('Excellent');
    expect(getNodeTier(100)).toBe('Excellent');
  });

  it('should return Good for scores 75-89', () => {
    expect(getNodeTier(75)).toBe('Good');
    expect(getNodeTier(80)).toBe('Good');
    expect(getNodeTier(89)).toBe('Good');
  });

  it('should return Poor for scores < 75', () => {
    expect(getNodeTier(74)).toBe('Poor');
    expect(getNodeTier(50)).toBe('Poor');
    expect(getNodeTier(0)).toBe('Poor');
  });
});

describe('calculateUtilization', () => {
  it('should calculate utilization correctly', () => {
    // 50GB used / 100GB total = 50%
    expect(calculateUtilization(50 * 1024 ** 3, 100 * 1024 ** 3)).toBe(50);
  });

  it('should return 0 for zero total storage', () => {
    expect(calculateUtilization(100, 0)).toBe(0);
  });

  it('should handle 100% utilization', () => {
    expect(calculateUtilization(100, 100)).toBe(100);
  });

  it('should round to 2 decimal places', () => {
    // 33.333... should round to 33.33
    expect(calculateUtilization(1, 3)).toBe(33.33);
  });
});

