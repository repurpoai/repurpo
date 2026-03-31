import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const sharedDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https://challenges.cloudflare.com https://*.supabase.co https://api.supadata.ai https://serpapi.com https://serpapi.com/search.json https://api.dodopayments.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "child-src 'self' https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests"
];

const strictContentSecurityPolicy = [
  ...sharedDirectives.slice(0, 5),
  `script-src 'self' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  `script-src-elem 'self' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  ...sharedDirectives.slice(5)
].join("; ");

const authContentSecurityPolicy = [
  ...sharedDirectives.slice(0, 5),
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  `script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  ...sharedDirectives.slice(5)
].join("; ");

const buildSecurityHeaders = (contentSecurityPolicy: string) => [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy.replace(/\s{2,}/g, " ").trim()
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()"
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin"
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin"
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none"
  },
  {
    key: "X-XSS-Protection",
    value: "0"
  }
];

const nextConfig: NextConfig = {
  experimental: {
    sri: {
      algorithm: "sha256"
    }
  },
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
  async headers() {
    return [
      {
        source: "/login",
        headers: buildSecurityHeaders(authContentSecurityPolicy)
      },
      {
        source: "/signup",
        headers: buildSecurityHeaders(authContentSecurityPolicy)
      },
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(strictContentSecurityPolicy)
      }
    ];
  }
};

export default nextConfig;
