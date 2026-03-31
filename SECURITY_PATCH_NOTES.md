Security-focused changes applied

1. Tightened the global security headers in next.config.ts.
2. Enabled experimental SRI (sha256) to support a stricter CSP without switching the whole app to dynamic rendering.
3. Removed unsafe-inline from script-src and script-src-elem.
4. Added COOP, CORP, X-Permitted-Cross-Domain-Policies, and X-XSS-Protection: 0.
5. Made login and signup forms explicitly submit via POST so scanners stop treating them as GET forms.
6. Added same-origin checks on login, signup, checkout, and image-generation POST routes.
7. Added private, no-store cache headers to auth/session responses to reduce Set-Cookie caching risk.
8. Normalized cookie options to enforce Secure in production and SameSite=Lax by default.
9. Updated middleware matcher to skip router prefetch requests.

Manual follow-up still recommended

1. Add a real /.well-known/security.txt once you have a real contact email or security contact URL.
2. Re-run the scanner after deployment.
3. If the CSP still complains in production, test the SRI build once on Vercel. If your stack uses any inline third-party script that still violates CSP, switch only the affected routes to nonce-based CSP instead of making the entire app dynamic.


Additional build/import fixes:
- Restored getClientIp helper in lib/security.ts for auth routes.
- Corrected signup route imports so Turnstile verification and IP lookup come from lib/security.ts.
- Removed an unused NextResponse import in the login route.
