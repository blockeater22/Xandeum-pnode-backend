/**
 * Geo Location Service
 * 
 * Provides IP geolocation resolution using ip-api.com (free, no key required).
 * Results are aggressively cached (24h TTL) to minimize API calls.
 */

import { geoCacheService } from "./redis.service";

export interface GeoLocation {
  lat: number;
  lng: number;
  country: string;
  region: string;
  city?: string;
}

const GEO_CACHE_KEY_PREFIX = "geo:";
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Extract IP address from address string (format: "ip:port" or just "ip")
 */
function extractIP(address: string | undefined): string | null {
  if (!address) return null;
  
  // Remove port if present (format: "ip:port")
  const ip = address.split(':')[0].trim();
  
  // Basic IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    return null;
  }
  
  return ip;
}

/**
 * Resolve IP address to geographic location using ip-api.com
 * Results are cached for 24 hours to minimize API calls.
 * 
 * @param ip - IP address to resolve
 * @param timeoutMs - Request timeout in milliseconds (default: 5000)
 * @returns GeoLocation or null if resolution fails
 */
export async function resolveIPToGeo(ip: string, timeoutMs: number = 5000): Promise<GeoLocation | null> {
  // Check cache first (Redis-backed with in-memory fallback)
  const cacheKey = `${GEO_CACHE_KEY_PREFIX}${ip}`;
  const cached = await geoCacheService.get<GeoLocation>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Create fetch promise with timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      status?: string;
      message?: string;
      lat?: number | string;
      lon?: number | string;
      country?: string;
      regionName?: string;
      city?: string;
    };

    // Check if API returned an error
    if (data.status === 'fail') {
      return null;
    }

    // Validate required fields
    if (!data.lat || !data.lon || !data.country) {
      return null;
    }

    const geo: GeoLocation = {
      lat: typeof data.lat === 'string' ? parseFloat(data.lat) : data.lat,
      lng: typeof data.lon === 'string' ? parseFloat(data.lon) : data.lon,
      country: data.country || 'Unknown',
      region: data.regionName || 'Unknown',
      city: data.city || undefined,
    };

    // Cache the result for 24 hours (Redis-backed with in-memory fallback)
    await geoCacheService.set(cacheKey, geo, GEO_CACHE_TTL_MS);

      return geo;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Handle timeout/abort errors silently
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        return null;
      }
      
      throw fetchError; // Re-throw other errors
    }
  } catch (error) {
    // Handle network errors and other failures silently
    return null;
  }
}

/**
 * Resolve IP address from node address string
 * Handles extraction and validation before calling geo resolver
 * 
 * @param address - Node address string (format: "ip:port" or just "ip")
 * @param timeoutMs - Request timeout in milliseconds (default: 3000)
 */
export async function resolveNodeGeo(address: string | undefined, timeoutMs: number = 3000): Promise<GeoLocation | null> {
  const ip = extractIP(address);
  if (!ip) {
    return null;
  }

  return resolveIPToGeo(ip, timeoutMs);
}

