"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  sm: 440,
  md: 560,
  lg: 720,
  xl: 920,
};

/**
 * Modal — built on @radix-ui/react-dialog (industry standard).
 * Renders into document.body via Portal — no parent-stacking-context bugs.
 * Includes focus trap, ESC handling, scroll lock, ARIA attributes.
 */
export function Modal({
  children,
  onClose,
  size = "md",
}: {
  children: React.ReactNode;
  onClose: () => void;
  size?: Size;
}) {
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="modal-shell"
          style={{ ["--modal-w" as string]: `${SIZE_PX[size]}px` } as React.CSSProperties}
          onOpenAutoFocus={(e) => {
            // Focus the first input rather than the close button
            e.preventDefault();
            const root = e.currentTarget as HTMLElement;
            const first = root.querySelector<HTMLElement>("input, select, textarea, button[type=submit]");
            first?.focus();
          }}
        >
          {/* Hidden defaults so Radix doesn't warn */}
          <Dialog.Title className="sr-only">Dialog</Dialog.Title>
          <Dialog.Description className="sr-only">Form dialog</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
}) {
  return (
    <header className="modal-header">
      <div className="modal-header-text">
        <div className="modal-title">{title}</div>
        {subtitle && <div className="modal-subtitle">{subtitle}</div>}
      </div>
      {onClose && (
        <Dialog.Close asChild>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn modal-close-btn"
            aria-label="Schließen"
            title="Schließen"
          >
            <X size={16} />
          </button>
        </Dialog.Close>
      )}
    </header>
  );
}

export function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="modal-body">{children}</div>;
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <footer className="modal-footer">{children}</footer>;
}
