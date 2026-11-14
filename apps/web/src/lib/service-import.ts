import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { ServiceCategorySchema, ServiceProtectionSchema, ServiceSchema, type Service } from "@/server/config/schema";

/* v18: Dienste als Liste einlesen. Vorhandene Einträge werden nur ergänzt, nie überschrieben,
   damit ein Import gefahrlos wiederholt werden kann. */

const Url = z.string().url();

export const ImportEntrySchema = z
  .object({
    name: z.string().min(1),
    url: Url.optional(),
    urlInternal: Url.optional(),
    urlExternal: Url.optional(),
    category: ServiceCategorySchema.optional(),
    protection: ServiceProtectionSchema.optional(),
    description: z.string().optional(),
    /** Status codes that count as healthy, e.g. [404] for an API without a start page. */
    expectStatus: z.array(z.number().int().min(100).max(599)).min(1).optional(),
    pinnedToHome: z.boolean().optional(),
  })
  .refine((e) => e.url || e.urlInternal || e.urlExternal, { message: "Mindestens eine Adresse ist nötig" });
export type ImportEntry = z.infer<typeof ImportEntrySchema>;

export const ImportListSchema = z.array(ImportEntrySchema).min(1).max(300);

export type ImportPlan = {
  services: Service[];
  added: string[];
  updated: { name: string; changes: string[] }[];
  unchanged: string[];
};

const DEFAULT_STATUS = [200, 204, 301, 302, 401];

function host(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

const hostsOf = (s: { url?: string | undefined; urlInternal?: string | undefined; urlExternal?: string | undefined }) =>
  [s.url, s.urlInternal, s.urlExternal].map(host).filter((h): h is string => h !== null);

const norm = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export function planImport(existing: Service[], entries: ImportEntry[], boardId = "home"): ImportPlan {
  const services = existing.map((s) => ({ ...s, pingTarget: { ...s.pingTarget } }));
  const plan: ImportPlan = { services, added: [], updated: [], unchanged: [] };

  for (const entry of entries) {
    const entryHosts = hostsOf(entry);
    const match =
      services.find((s) => hostsOf(s).some((h) => entryHosts.includes(h))) ??
      services.find((s) => norm(s.name) === norm(entry.name));

    if (!match) {
      const primary = entry.urlExternal ?? entry.url ?? entry.urlInternal!;
      // Health is checked from inside the network when possible: behind a login proxy the
      // external address answers with a redirect even while the service itself is down.
      const probe = entry.urlInternal ?? primary;
      services.push(
        ServiceSchema.parse({
          id: uuidv4(),
          name: entry.name,
          description: entry.description,
          url: primary,
          urlInternal: entry.urlInternal,
          urlExternal: entry.urlExternal ?? (entry.url && entry.url !== entry.urlInternal ? entry.url : undefined),
          protection: entry.protection ?? "unknown",
          category: entry.category ?? "tools",
          icon: "globe",
          pingTarget: { kind: "http", url: probe, expectStatus: entry.expectStatus ?? DEFAULT_STATUS, timeoutMs: 3000 },
          sortOrder: services.length * 10,
          enabled: true,
          boardId,
          pinnedToHome: entry.pinnedToHome ?? false,
        }),
      );
      plan.added.push(entry.name);
      continue;
    }

    const changes: string[] = [];
    if (!match.urlInternal && entry.urlInternal) {
      match.urlInternal = entry.urlInternal;
      changes.push("Adresse intern");
    }
    const ext = entry.urlExternal ?? (entry.url && entry.url !== entry.urlInternal ? entry.url : undefined);
    if (!match.urlExternal && ext && ext !== match.urlInternal) {
      match.urlExternal = ext;
      changes.push("Adresse extern");
    }
    if (match.protection === "unknown" && entry.protection && entry.protection !== "unknown") {
      match.protection = entry.protection;
      changes.push("Absicherung");
    }
    if (entry.expectStatus && entry.expectStatus.join() !== match.pingTarget.expectStatus.join()) {
      match.pingTarget.expectStatus = entry.expectStatus;
      changes.push("erwartete Antwort");
    }
    if (!match.description && entry.description) {
      match.description = entry.description;
      changes.push("Beschreibung");
    }
    if (changes.length > 0) plan.updated.push({ name: match.name, changes });
    else plan.unchanged.push(match.name);
  }
  return plan;
}
