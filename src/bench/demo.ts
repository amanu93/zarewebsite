/**
 * Demo mode: seeded data, no passwords checked, and anyone can sign in as
 * any staff member to look around. OFF by default — the portal runs against
 * the landing-api. Only the unit tests switch it on (vitest sets
 * NEXT_PUBLIC_BENCH_DEMO_MODE=true), so the business-rule suites keep
 * their in-memory fixture. Deployment sets nothing.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_BENCH_DEMO_MODE === 'true';
