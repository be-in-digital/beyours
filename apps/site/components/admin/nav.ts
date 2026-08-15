import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  TrendingUp,
  RefreshCw,
  FileText,
  Users,
  UserPlus,
  Share2,
  Server,
  TriangleAlert,
  Activity,
  Settings,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage",
    items: [{ href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard }],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/ventes", label: "Ventes & revenus", icon: TrendingUp },
      { href: "/admin/abonnements", label: "Abonnements", icon: RefreshCw },
      { href: "/admin/factures", label: "Factures", icon: FileText },
    ],
  },
  {
    label: "Relation client",
    items: [
      { href: "/admin/clients", label: "Clients", icon: Users },
      { href: "/admin/prospects", label: "Prospects", icon: UserPlus },
      { href: "/admin/apporteurs", label: "Apporteurs d'affaires", icon: Share2 },
    ],
  },
  {
    label: "Exploitation",
    items: [
      { href: "/admin/flotte", label: "Déploiements", icon: Server },
      { href: "/admin/incidents", label: "Incidents", icon: TriangleAlert },
      { href: "/admin/monitoring", label: "Monitoring", icon: Activity },
    ],
  },
  {
    label: "Système",
    items: [{ href: "/admin/parametres", label: "Paramètres", icon: Settings }],
  },
];

export function titleForPath(pathname: string): string {
  const exact: Record<string, string> = {
    "/admin": "Vue d'ensemble",
    "/admin/ventes": "Ventes & revenus",
    "/admin/abonnements": "Abonnements & maintenance",
    "/admin/factures": "Factures",
    "/admin/clients": "Clients",
    "/admin/prospects": "Prospects",
    "/admin/apporteurs": "Apporteurs d'affaires",
    "/admin/flotte": "Déploiements",
    "/admin/incidents": "Incidents",
    "/admin/incidents/nouveau": "Nouvel incident",
    "/admin/monitoring": "Monitoring",
    "/admin/parametres": "Paramètres",
  };
  if (exact[pathname]) return exact[pathname];
  if (pathname.startsWith("/admin/flotte/")) return "Déploiement";
  if (pathname.startsWith("/admin/incidents/")) return "Incident";
  return "Superadmin";
}
