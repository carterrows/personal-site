import type { APIContext } from "astro";

export const prerender = false;

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientIp(context: APIContext): string {
  const forwardedFor = context.request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    if (firstIp && firstIp.trim().length > 0) {
      return firstIp.trim();
    }
  }

  const realIp = context.request.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }

  if (context.clientAddress && context.clientAddress.trim().length > 0) {
    return context.clientAddress.trim();
  }

  return "unknown";
}

function pruneExpiredBuckets(now: number): void {
  if (buckets.size < 1024) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export async function GET(context: APIContext): Promise<Response> {
  const now = Date.now();
  const clientIp = getClientIp(context);
  const currentBucket = buckets.get(clientIp);

  if (!currentBucket || currentBucket.resetAt <= now) {
    buckets.set(clientIp, {
      count: 1,
      resetAt: now + WINDOW_MS
    });
  } else if (currentBucket.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((currentBucket.resetAt - now) / 1000));

    return new Response("Too many resume download attempts. Please try again in a minute.", {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": retryAfterSeconds.toString()
      }
    });
  } else {
    currentBucket.count += 1;
  }

  pruneExpiredBuckets(now);

  return new Response(null, {
    status: 302,
    headers: {
      "cache-control": "no-store",
      location: new URL("/resume.pdf", context.url).toString()
    }
  });
}
