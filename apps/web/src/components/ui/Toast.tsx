"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string | undefined;
  ttl: number;
};

type ToastContext = {
  push: (t: Omit<Toast, "id" | "ttl"> & { ttl?: number }) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
};

const Ctx = createContext<ToastContext | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((s) => s.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastContext["push"]>((t) => {
    const id = Date.now() + Math.random();
    const ttl = t.ttl ?? 3500;
    setToasts((s) => [...s, { id, kind: t.kind, title: t.title, body: t.body, ttl }]);
    if (ttl > 0) setTimeout(() => dismiss(id), ttl);
  }, [dismiss]);

  const success = useCallback<ToastContext["success"]>((title, body) => push({ kind: "success", title, body }), [push]);
  const error = useCallback<ToastContext["error"]>((title, body) => push({ kind: "error", title, body, ttl: 6000 }), [push]);
  const info = useCallback<ToastContext["info"]>((title, body) => push({ kind: "info", title, body }), [push]);

  return (
    <Ctx.Provider value={{ push, success, error, info }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (toast.ttl <= 0) return;
    const t = setTimeout(() => setClosing(true), Math.max(0, toast.ttl - 250));
    return () => clearTimeout(t);
  }, [toast.ttl]);

  const Icon = toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? AlertTriangle : Info;

  return (
    <div className={`toast toast-${toast.kind} ${closing ? "toast-closing" : ""}`}>
      <Icon size={14} className="toast-icon" />
      <div className="toast-text">
        <div className="toast-title">{toast.title}</div>
        {toast.body && <div className="toast-body">{toast.body}</div>}
      </div>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Schließen">
        <X size={12} />
      </button>
    </div>
  );
}

export function useToast(): ToastContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback: non-blocking no-op so this hook is safe even outside the provider.
    return {
      push: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
