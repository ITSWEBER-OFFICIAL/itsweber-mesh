"use client";

import { useRef, useState } from "react";
import { Download, Upload, TriangleAlert, RotateCcw } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

type RestoreResult = { ok: true; fromVersion: number; toVersion: number } | { ok: false; error: string };

export default function AdminBackupPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  // ── Export ────────────────────────────────────────────────────────────────

  function handleDownload() {
    window.location.href = "/api/admin/backup";
  }

  // ── Import ────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast.error("Ungültige Datei", "Nur .json-Dateien sind erlaubt.");
      return;
    }
    setPendingFile(file);
    // reset so the same file can be re-selected
    e.target.value = "";
  }

  async function handleConfirmRestore() {
    if (!pendingFile) return;
    setRestoring(true);
    try {
      const text = await pendingFile.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        toast.error("Ungültige Datei", "Die Datei enthält kein gültiges JSON.");
        return;
      }

      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = (await res.json()) as RestoreResult;

      if (!data.ok) {
        toast.error("Restore fehlgeschlagen", data.error);
        return;
      }

      const migMsg =
        data.fromVersion !== data.toVersion
          ? ` (Schema v${data.fromVersion} → v${data.toVersion} migriert)`
          : "";
      toast.success("Backup eingespielt", `Konfiguration wurde wiederhergestellt${migMsg}. Seite wird neu geladen…`);
      setTimeout(() => window.location.reload(), 1800);
    } catch {
      toast.error("Netzwerkfehler", "Backup konnte nicht gesendet werden.");
    } finally {
      setRestoring(false);
      setPendingFile(null);
    }
  }

  return (
    <div className="flex flex-col gap-[28px]" style={{ maxWidth: 600 }}>

      {/* ── Backup erstellen ─────────────────────────────────────────────── */}
      <div className="admin-card">
        <div className="admin-card-title">Backup erstellen</div>
        <div className="admin-card-sub">
          Lädt die aktuelle Konfiguration als JSON-Datei herunter — inkl. Services,
          Integrationen, Widgets, Boards, Kameras, Auth und Theme.
          Uploads (Hintergrundbilder) sind nicht enthalten.
        </div>

        <div className="flex flex-col gap-[12px]" style={{ marginTop: 20 }}>
          <div className="admin-info-row">
            <span className="admin-info-label">Enthält</span>
            <span className="admin-info-value">
              Services · Widgets · Boards · Integrationen · Auth · Theme · Quick-Links · Kameras
            </span>
          </div>
          <div className="admin-info-row">
            <span className="admin-info-label">Nicht enthalten</span>
            <span className="admin-info-value">Hochgeladene Bilder (uploads/)</span>
          </div>
        </div>

        <button
          className="admin-btn admin-btn-primary"
          style={{ marginTop: 20, gap: 8, display: "inline-flex", alignItems: "center" }}
          onClick={handleDownload}
          type="button"
        >
          <Download size={15} />
          Backup herunterladen
        </button>
      </div>

      {/* ── Backup einspielen ────────────────────────────────────────────── */}
      <div className="admin-card">
        <div className="admin-card-title">Backup einspielen</div>
        <div className="admin-card-sub">
          Stellt eine zuvor heruntergeladene Konfiguration wieder her.
          Ältere Backups werden automatisch auf das aktuelle Schema migriert.
          Ein automatisches Sicherheits-Backup der aktuellen Konfiguration wird vor
          dem Überschreiben angelegt (<code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>config.json.pre-restore</code>).
        </div>

        <div
          className="flex flex-col gap-[10px]"
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 8,
            background: "color-mix(in srgb, var(--warning, #f59e0b) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--warning, #f59e0b) 35%, transparent)",
          }}
        >
          <div className="flex gap-[8px]" style={{ alignItems: "flex-start" }}>
            <TriangleAlert size={15} style={{ color: "var(--warning, #f59e0b)", flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--fg-muted)" }}>
              <strong>Achtung:</strong> Alle aktuellen Einstellungen werden durch das Backup ersetzt.
              Diese Aktion kann nicht rückgängig gemacht werden (außer über das automatische
              <code style={{ fontFamily: "var(--font-mono)" }}> config.json.pre-restore</code>).
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          aria-label="Backup-Datei auswählen"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button
          className="admin-btn admin-btn-secondary"
          style={{ marginTop: 16, gap: 8, display: "inline-flex", alignItems: "center" }}
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          <Upload size={15} />
          Backup-Datei auswählen…
        </button>
      </div>

      {/* ── Confirm-Modal ────────────────────────────────────────────────── */}
      {pendingFile && (
        <Modal onClose={() => setPendingFile(null)} size="sm">
          <ModalHeader title="Backup einspielen?" onClose={() => setPendingFile(null)} />
          <ModalBody>
            <div className="flex flex-col gap-[16px]">
              <div
                className="flex gap-[10px]"
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "color-mix(in srgb, var(--danger, #ef4444) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--danger, #ef4444) 30%, transparent)",
                  alignItems: "flex-start",
                }}
              >
                <TriangleAlert size={15} style={{ color: "var(--danger, #ef4444)", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--fg-muted)" }}>
                  Die gesamte aktuelle Konfiguration wird überschrieben.
                  Die aktuellen Einstellungen werden als{" "}
                  <code style={{ fontFamily: "var(--font-mono)" }}>config.json.pre-restore</code> gesichert.
                </p>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Datei</span>
                <span className="admin-info-value" style={{ wordBreak: "break-all" }}>
                  {pendingFile.name}
                </span>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              className="admin-btn admin-btn-secondary"
              onClick={() => setPendingFile(null)}
              type="button"
              disabled={restoring}
            >
              Abbrechen
            </button>
            <button
              className="admin-btn admin-btn-danger"
              onClick={handleConfirmRestore}
              type="button"
              disabled={restoring}
              style={{ gap: 8, display: "inline-flex", alignItems: "center" }}
            >
              <RotateCcw size={14} />
              {restoring ? "Wird eingespielt…" : "Jetzt einspielen"}
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
