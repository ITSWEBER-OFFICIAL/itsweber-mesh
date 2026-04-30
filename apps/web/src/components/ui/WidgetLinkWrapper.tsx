"use client";

import { ExternalLink } from "lucide-react";

type Props = {
  href: string | undefined;
  children: React.ReactNode;
  className?: string;
  /** When true, renders a plain div — no link, no click-through */
  editMode?: boolean | undefined;
};

export function WidgetLinkWrapper({ href, children, className, editMode }: Props) {
  const baseClass = className ?? "widget-link-wrapper";

  if (!href || editMode) {
    return <div className={baseClass}>{children}</div>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={baseClass}
    >
      {children}
      <span className="widget-link-indicator" aria-hidden>
        <ExternalLink size={10} />
      </span>
    </a>
  );
}
