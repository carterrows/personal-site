import type { APIContext } from "astro";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

export const prerender = false;

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_BUCKETS = 10_000;
const RESUME_PATH = path.resolve(process.cwd(), "private", "Rows_Carter_Resume.pdf");
const DOWNLOAD_FILENAME = "Rows_Carter_Resume.pdf";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function stripPort(rawValue: string): string {
  const trimmed = rawValue.trim();

  if (trimmed.startsWith("[")) {
    const bracketMatch = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/);
    return bracketMatch ? bracketMatch[1] : trimmed;
  }

  const colonCount = (trimmed.match(/:/g) ?? []).length;
  if (colonCount === 1 && trimmed.includes(".")) {
    return trimmed.slice(0, trimmed.lastIndexOf(":"));
  }

  return trimmed;
}

function normalizeIp(rawValue: string | null | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  const candidate = stripPort(rawValue);
  if (candidate.length === 0) {
    return null;
  }

  return isIP(candidate) ? candidate : null;
}

function isTrustedProxyAddress(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1") {
    return true;
  }

  if (ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return true;
  }

  if (ip.startsWith("172.")) {
    const octets = ip.split(".");
    const secondOctet = Number(octets[1]);
    return Number.isInteger(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
  }

  return ip.startsWith("fc")
    || ip.startsWith("fd")
    || ip.startsWith("fe80:");
}

function parseForwardedFor(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const parts = headerValue.split(",");
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const parsed = normalizeIp(parts[index]);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function getClientIp(context: APIContext): string {
  const directAddress = normalizeIp(context.clientAddress);

  if (directAddress && isTrustedProxyAddress(directAddress)) {
    const forwardedFor = parseForwardedFor(context.request.headers.get("x-forwarded-for"));
    if (forwardedFor) {
      return forwardedFor;
    }

    const realIp = normalizeIp(context.request.headers.get("x-real-ip"));
    if (realIp) {
      return realIp;
    }
  }

  if (directAddress) {
    return directAddress;
  }

  return "unknown";
}

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function ensureBucketCapacity(now: number): void {
  pruneExpiredBuckets(now);

  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (!oldestKey) {
      return;
    }

    buckets.delete(oldestKey);
  }
}

function buildRateLimitHeaders(bucket: Bucket, now: number): Record<string, string> {
  const secondsUntilReset = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - bucket.count);

  return {
    "x-ratelimit-limit": MAX_REQUESTS_PER_WINDOW.toString(),
    "x-ratelimit-remaining": remaining.toString(),
    "x-ratelimit-reset": secondsUntilReset.toString()
  };
}

export async function GET(context: APIContext): Promise<Response> {
  const now = Date.now();
  const clientIp = getClientIp(context);
  let currentBucket = buckets.get(clientIp);

  if (!currentBucket || currentBucket.resetAt <= now) {
    ensureBucketCapacity(now);
    currentBucket = {
      count: 0,
      resetAt: now + WINDOW_MS
    };
  }

  if (currentBucket.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((currentBucket.resetAt - now) / 1000));
    const rateLimitHeaders = buildRateLimitHeaders(currentBucket, now);

    return new Response("Too many resume download attempts. Please try again in a minute.", {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": retryAfterSeconds.toString(),
        ...rateLimitHeaders
      }
    });
  }

  currentBucket.count += 1;
  buckets.set(clientIp, currentBucket);
  const rateLimitHeaders = buildRateLimitHeaders(currentBucket, now);

  let resumeFile: Buffer;
  try {
    resumeFile = await readFile(RESUME_PATH);
  } catch {
    return new Response("Resume file is unavailable.", {
      status: 503,
      headers: {
        "cache-control": "no-store",
        ...rateLimitHeaders
      }
    });
  }

  return new Response(resumeFile, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/pdf",
      "content-length": resumeFile.byteLength.toString(),
      "content-disposition": `attachment; filename="${DOWNLOAD_FILENAME}"`,
      "x-content-type-options": "nosniff",
      ...rateLimitHeaders
    }
  });
}
