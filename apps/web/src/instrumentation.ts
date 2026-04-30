// Node.js startup logic has moved to instrumentation.node.ts.
// This file is intentionally minimal — it must not import any Node.js-only
// modules because Next.js compiles it for all runtimes (including Edge) when a
// middleware.ts is present.
export async function register() {
  // intentionally empty — see instrumentation.node.ts
}
