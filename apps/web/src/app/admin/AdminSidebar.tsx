"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Server, Network, Camera, Layers, Link2,
  Plug, Palette, Code2, ShieldCheck, Users,
  LayoutDashboard, ChevronRight, HelpCircle, Info, Columns3, Search, DatabaseBackup,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    defaultOpen: true,
    items: [
      { href: "/admin", icon: <LayoutDashboard size={15} />, label: "Einstellungen" },
    ],
  },
  {
    label: "Inhalte",
    defaultOpen: true,
    items: [
      { href: "/admin/services",        icon: <LayoutGrid size={15} />, label: "Services" },
      { href: "/admin/infra-nodes",     icon: <Server size={15} />,     label: "Server-Karten" },
      { href: "/admin/network-devices", icon: <Network size={15} />,    label: "Netzwerk-Geräte" },
      { href: "/admin/cameras",         icon: <Camera size={15} />,     label: "Kameras" },
      { href: "/admin/widgets",         icon: <Layers size={15} />,     label: "Widgets" },
      { href: "/admin/quick-links",     icon: <Link2 size={15} />,      label: "Quick-Access" },
    ],
  },
  {
    label: "Layout",
    defaultOpen: true,
    items: [
      { href: "/admin/boards",            icon: <Columns3 size={15} />,         label: "Boards" },
      { href: "/admin/command-overview",  icon: <LayoutDashboard size={15} />,  label: "Command Overview" },
    ],
  },
  {
    label: "Integrationen",
    defaultOpen: false,
    items: [
      { href: "/admin/integrations", icon: <Plug size={15} />, label: "Integrationen" },
    ],
  },
  {
    label: "Benutzer & Sicherheit",
    defaultOpen: false,
    items: [
      { href: "/admin/users", icon: <Users size={15} />,      label: "Benutzer" },
      { href: "/admin/auth",  icon: <ShieldCheck size={15} />, label: "Auth" },
    ],
  },
  {
    label: "System",
    defaultOpen: false,
    items: [
      { href: "/admin/theme",      icon: <Palette size={15} />,         label: "Theme" },
      { href: "/admin/custom-css", icon: <Code2 size={15} />,           label: "Custom CSS" },
      { href: "/admin/search",     icon: <Search size={15} />,          label: "Suche" },
      { href: "/admin/backup",     icon: <DatabaseBackup size={15} />,  label: "Backup & Restore" },
    ],
  },
  {
    label: "Hilfe",
    defaultOpen: false,
    items: [
      { href: "/admin/help", icon: <HelpCircle size={15} />, label: "Hilfe & FAQ" },
    ],
  },
  {
    label: "Über",
    defaultOpen: false,
    items: [
      { href: "/admin/about", icon: <Info size={15} />, label: "Über ITSWEBER Mesh" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(GROUPS.map((g) => [g.label, g.defaultOpen ?? false])),
  );

  function toggle(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <aside className="admin-sidebar">
      {GROUPS.map((group) => {
        const open = openGroups[group.label] ?? false;
        const hasActive = group.items.some((i) => isActive(i.href));

        return (
          <div key={group.label} className="admin-nav-group">
            <button
              className={`admin-nav-group-header${hasActive && !open ? " admin-nav-group-header-hint" : ""}`}
              onClick={() => toggle(group.label)}
              type="button"
            >
              <span className="admin-nav-group-label">{group.label}</span>
              <ChevronRight
                size={12}
                className="admin-nav-group-chevron"
                style={{ transform: open ? "rotate(90deg)" : undefined }}
              />
            </button>
            {open && (
              <div className="admin-nav-group-items">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-nav-link${isActive(item.href) ? " admin-nav-link-active" : ""}`}
                  >
                    <span style={{ color: isActive(item.href) ? "var(--brand)" : "var(--brand)", flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
