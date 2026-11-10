import type { Route } from "next";
import { Building2, Inbox, LayoutDashboard, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile tab bar (keep to ≤ 4). */
  mobile?: boolean;
  badge?: "attention";
  match: (pathname: string) => boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Navigation registry. Future modules (Quotes, Reservations, Payments…) add a
 * section here when they ship — never before. No placeholder pages.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Command Center", icon: LayoutDashboard, mobile: true, match: (p) => p === "/" },
      { href: "/leads", label: "Leads", icon: Inbox, mobile: true, badge: "attention", match: (p) => p.startsWith("/leads") },
      { href: "/customers", label: "Customers", icon: Users, mobile: true, match: (p) => p.startsWith("/customers") },
      { href: "/operators", label: "Operators", icon: Building2, mobile: true, match: (p) => p.startsWith("/operators") },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
