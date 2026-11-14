/* Protokoll der Aktionen. Eine Zeile JSON je Eintrag in /data/audit.log.
   Geschrieben wird vor und nach jeder Aktion, damit auch ein Abbruch sichtbar bleibt. */
import fs from "node:fs";
import path from "node:path";

export type AuditEntry = {
  at: string;
  user: string;
  /** e.g. "container.restart" */
  action: string;
  target: string;
  system: string;
  result: "ok" | "failed" | "refused";
  detail?: string;
};

const MAX_BYTES = 1_000_000;

function auditPath(): string {
  return path.join(process.env["DATA_DIR"] ?? "/data", "audit.log");
}

export function writeAudit(entry: Omit<AuditEntry, "at">, now: Date = new Date()): AuditEntry {
  const full: AuditEntry = { at: now.toISOString(), ...entry };
  const file = auditPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Keep the file bounded: once it is too large, the older half moves to audit.log.1.
  try {
    if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.1`);
  } catch {
    // no file yet
  }
  fs.appendFileSync(file, JSON.stringify(full) + "\n", { encoding: "utf8", mode: 0o600 });
  return full;
}

/** Newest first. Unreadable lines are skipped, they must not hide the rest. */
export function readAudit(limit = 100): AuditEntry[] {
  let raw: string;
  try {
    raw = fs.readFileSync(auditPath(), "utf8");
  } catch {
    return [];
  }
  const out: AuditEntry[] = [];
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const line = lines[i];
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as AuditEntry);
    } catch {
      // skip
    }
  }
  return out;
}
