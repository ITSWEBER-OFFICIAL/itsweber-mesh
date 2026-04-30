import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "../init";
import { readConfig, patchConfig } from "../../config/store";
import { AuthModeSchema } from "../../config/schema";
import { clearOidcCache } from "../../auth/oidc-client";

const BackgroundPatchSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("solid") }),
  z.object({ kind: z.literal("image"), src: z.string().min(1) }),
  z.object({ kind: z.literal("gradient") }),
]);

const ThemePatchSchema = z.object({
  preset: z.enum(["dark", "light", "terminal", "itsweber", "slate", "modern-light", "graphite-command"]).optional(),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  customCss: z.string().optional(),
  background: BackgroundPatchSchema.optional(),
  backgroundPattern: z.enum(["none", "mesh", "dots", "stripes"]).optional(),
});

const QuickActionPatchSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  url: z.string().min(1),
  iconEmoji: z.string().optional(),
  target: z.enum(["_blank", "_self"]).default("_blank"),
  sortOrder: z.number().int().default(0),
});

const MetaPatchSchema = z.object({
  name: z.string().min(1).optional(),
  locale: z.enum(["de", "en"]).optional(),
  subtitle: z.string().optional(),
  domain: z.string().optional(),
  commandOverviewSubtitle: z.string().optional(),
  quickActions: z.array(QuickActionPatchSchema).optional(),
});

const LayoutPatchSchema = z.object({
  showQuickAccess: z.boolean().optional(),
  showSystemBadge: z.boolean().optional(),
  serviceCardShowCategory: z.boolean().optional(),
  showCommandOverview: z.boolean().optional(),
});

const Oauth2PatchSchema = z.object({
  issuerUrl: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  adminGroupClaim: z.string().optional(),
  adminGroupValues: z.array(z.string()).optional(),
  editorGroupValues: z.array(z.string()).optional(),
  fallbackRole: z.enum(["admin", "editor", "viewer"]).optional(),
  providerLabel: z.string().optional(),
  callbackPath: z.string().optional(),
});

const AuthPatchSchema = z.object({
  mode: AuthModeSchema.optional(),
  oauth2: Oauth2PatchSchema.optional(),
});

export const settingsRouter = router({
  get: publicProcedure.query(() => {
    const config = readConfig();
    return {
      meta: config.meta,
      theme: config.theme,
      layout: config.layout,
      auth: { mode: config.auth.mode },
    };
  }),

  updateTheme: adminProcedure
    .input(ThemePatchSchema)
    .mutation(async ({ input }) => {
      const config = readConfig();
      const updated = {
        preset: input.preset ?? config.theme.preset,
        accent: input.accent ?? config.theme.accent,
        background: input.background ?? config.theme.background,
        backgroundPattern: input.backgroundPattern ?? config.theme.backgroundPattern,
        customCss: input.customCss ?? config.theme.customCss,
      };
      await patchConfig({ theme: updated });
      return updated;
    }),

  updateMeta: adminProcedure
    .input(MetaPatchSchema)
    .mutation(async ({ input }) => {
      const config = readConfig();
      const updated = {
        ...config.meta,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
        ...(input.domain !== undefined ? { domain: input.domain } : {}),
        ...(input.commandOverviewSubtitle !== undefined
          ? { commandOverviewSubtitle: input.commandOverviewSubtitle }
          : {}),
        ...(input.quickActions !== undefined ? { quickActions: input.quickActions } : {}),
      };
      await patchConfig({ meta: updated });
      return updated;
    }),

  updateLayout: adminProcedure
    .input(LayoutPatchSchema)
    .mutation(async ({ input }) => {
      const config = readConfig();
      const layout = { ...config.layout };
      if (input.showQuickAccess !== undefined) layout.showQuickAccess = input.showQuickAccess;
      if (input.showSystemBadge !== undefined) layout.showSystemBadge = input.showSystemBadge;
      if (input.serviceCardShowCategory !== undefined) {
        layout.serviceCardShowCategory = input.serviceCardShowCategory;
      }
      if (input.showCommandOverview !== undefined) {
        layout.showCommandOverview = input.showCommandOverview;
      }
      await patchConfig({ layout });
      return layout;
    }),

  updateAuth: adminProcedure
    .input(AuthPatchSchema)
    .mutation(async ({ input }) => {
      const config = readConfig();
      const next = { ...config.auth };

      // Apply oauth2 patch first so the mode-switch guard can see the new values
      if (input.oauth2 !== undefined) {
        const patch = input.oauth2;
        next.oauth2 = {
          ...config.auth.oauth2,
          ...(patch.issuerUrl !== undefined ? { issuerUrl: patch.issuerUrl.trim() } : {}),
          ...(patch.clientId !== undefined ? { clientId: patch.clientId.trim() } : {}),
          ...(patch.clientSecret !== undefined ? { clientSecret: patch.clientSecret } : {}),
          ...(patch.scopes !== undefined ? { scopes: patch.scopes } : {}),
          ...(patch.adminGroupClaim !== undefined ? { adminGroupClaim: patch.adminGroupClaim } : {}),
          ...(patch.adminGroupValues !== undefined ? { adminGroupValues: patch.adminGroupValues } : {}),
          ...(patch.editorGroupValues !== undefined ? { editorGroupValues: patch.editorGroupValues } : {}),
          ...(patch.fallbackRole !== undefined ? { fallbackRole: patch.fallbackRole } : {}),
          ...(patch.providerLabel !== undefined ? { providerLabel: patch.providerLabel } : {}),
          ...(patch.callbackPath !== undefined ? { callbackPath: patch.callbackPath } : {}),
        };
      }

      if (input.mode !== undefined) {
        // Safety guard: refuse to switch to token mode if ADMIN_TOKEN env is unset.
        if (input.mode === "token" && !process.env["ADMIN_TOKEN"]) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "ADMIN_TOKEN Environment-Variable ist nicht gesetzt. Setze sie zuerst im Container (z.B. -e ADMIN_TOKEN=<deinToken>) und starte den Container neu, bevor du auf Token-Mode wechselst.",
          });
        }
        // Refuse userPassword mode if no users exist yet (would lock everyone out)
        if (input.mode === "userPassword" && config.auth.users.length === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Lege zuerst mindestens einen Benutzer an, bevor du auf userPassword-Modus wechselst.",
          });
        }
        // Refuse oauth2 mode if config is incomplete or session secret missing.
        if (input.mode === "oauth2") {
          const issuer = (next.oauth2.issuerUrl ?? "").trim();
          const cid = (next.oauth2.clientId ?? "").trim();
          if (!issuer || !cid) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "OIDC-Konfiguration unvollständig: bitte zuerst issuerUrl und clientId setzen, dann auf oauth2 umstellen.",
            });
          }
          if (!process.env["MESH_SESSION_SECRET"] || process.env["MESH_SESSION_SECRET"].length < 32) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "MESH_SESSION_SECRET fehlt oder ist zu kurz (≥32 Zeichen). Setze die Variable im Container (z.B. -e MESH_SESSION_SECRET=<32+chars>) und starte neu.",
            });
          }
        }
        next.mode = input.mode;
      }
      await patchConfig({ auth: next });
      // Invalidate cached openid-client discovery so a freshly rotated
      // clientSecret/issuerUrl/clientId takes effect immediately rather than
      // after the 1h TTL.
      if (input.oauth2 !== undefined) {
        clearOidcCache();
      }
      return { mode: next.mode };
    }),

  /** Admin-only fetch of the full auth.oauth2 config for the admin UI form.
   *  clientSecret is never returned in plaintext — only as a `hasSecret` flag. */
  getAuthConfig: adminProcedure.query(() => {
    const config = readConfig();
    const o = config.auth.oauth2;
    return {
      mode: config.auth.mode,
      oauth2: {
        issuerUrl: o.issuerUrl ?? "",
        clientId: o.clientId ?? "",
        hasClientSecret: Boolean(o.clientSecret),
        scopes: o.scopes,
        adminGroupClaim: o.adminGroupClaim ?? "",
        adminGroupValues: o.adminGroupValues,
        editorGroupValues: o.editorGroupValues,
        fallbackRole: o.fallbackRole,
        providerLabel: o.providerLabel ?? "",
        callbackPath: o.callbackPath ?? "",
      },
      migrationWarnings: config.meta.migrationWarnings,
    };
  }),

  /** Public probe so the auth-admin UI can warn the user before they switch modes. */
  authProbe: publicProcedure.query(() => ({
    adminTokenSet: Boolean(process.env["ADMIN_TOKEN"]),
    sessionSecretSet:
      Boolean(process.env["MESH_SESSION_SECRET"]) &&
      (process.env["MESH_SESSION_SECRET"]?.length ?? 0) >= 32,
  })),

  /** Called by the First-Run-Wizard to mark setup as complete. Public — no session yet. */
  completeFirstRun: publicProcedure.mutation(async () => {
    const config = readConfig();
    if (config.meta.firstRunCompleted) return { ok: true };
    await patchConfig({ meta: { ...config.meta, firstRunCompleted: true } });
    return { ok: true };
  }),
});
