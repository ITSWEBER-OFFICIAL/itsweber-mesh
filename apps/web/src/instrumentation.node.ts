export const runtime = "nodejs";

export async function register() {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;

  // ── OIDC bootstrap validation ────────────────────────────────────────────
  // If auth.mode === "oauth2" we require MESH_SESSION_SECRET to be set with
  // sufficient entropy AND issuerUrl/clientId to be configured. This refuses
  // to start the server in misconfigured oauth2 mode rather than silently
  // falling back to an insecure path.
  const { bootstrapConfigForRuntime } = await import("./server/config/store");
  const { validateSessionSecret } = await import("./server/auth/oidc-session");
  const { logger } = await import("./server/logger");

  try {
    const config = bootstrapConfigForRuntime();
    if (config.auth.mode === "oauth2") {
      const issuerUrl = (config.auth.oauth2.issuerUrl ?? "").trim();
      const clientId = (config.auth.oauth2.clientId ?? "").trim();
      if (!issuerUrl || !clientId) {
        logger.fatal(
          "auth.mode='oauth2' but auth.oauth2.issuerUrl/clientId is empty. " +
            "Configure OIDC under Admin → Auth or set auth.mode to 'open'/'userPassword'.",
        );
        throw new Error("OIDC misconfigured: issuerUrl/clientId missing");
      }
      const check = validateSessionSecret(process.env["MESH_SESSION_SECRET"]);
      if (!check.ok) {
        logger.fatal(check.reason);
        throw new Error(`OIDC misconfigured: ${check.reason}`);
      }
      logger.info(
        { issuerUrl, clientId },
        "OIDC mode bootstrap OK — session secret + issuer/clientId verified",
      );
    }

    // Surface migration warnings as logs so operators see them on container start
    if (config.meta.migrationWarnings.length > 0) {
      logger.warn(
        { warnings: config.meta.migrationWarnings },
        "Schema migration produced warnings — see admin UI for details",
      );
    }
  } catch (err) {
    // Re-throw; Next.js will print the error and refuse to serve requests.
    throw err;
  }

  const { startScheduler } = await import("./server/healthcheck/scheduler");
  startScheduler();
}
