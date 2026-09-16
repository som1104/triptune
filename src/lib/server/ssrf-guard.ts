import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "[::1]", "::1"]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // malformed, reject
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 0) return true; // 0.0.0.0/8
  if (a >= 224) return true; // multicast + reserved (224.0.0.0/4, 240.0.0.0/4)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true; // link-local fe80::/10
  }
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded IPv4 too.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateIP(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // not a recognizable IP, treat as unsafe
}

/**
 * Validates a user-supplied URL is safe to fetch server-side: http(s) only,
 * not a literal localhost/private-IP host, and — via DNS resolution — not a
 * hostname that resolves to one either (blocks basic DNS-rebinding SSRF).
 * Throws with a user-safe message on any violation.
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("INVALID_URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("INVALID_URL");
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new Error("BLOCKED_HOST");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new Error("BLOCKED_HOST");
    return url;
  }

  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new Error("DNS_FAILED");
  }

  if (addresses.length === 0 || addresses.some(isPrivateIP)) {
    throw new Error("BLOCKED_HOST");
  }

  return url;
}
