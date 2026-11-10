import {
  BadgeCheck, CalendarRange, Database, ExternalLink, GalleryHorizontal, GraduationCap, IdCard, Images, Inbox, LayoutDashboard, LineChart,
  Megaphone, MessageSquareText, ScrollText, Settings, ShieldCheck, UserCog, Users, UserX, type LucideIcon,
} from "lucide-react";

// Back-office menu shape shared by the layout (server: builds it, permission by permission) and the shell (client).

export const NAV_ICONS = {
  overview: LayoutDashboard, visits: LineChart, voice: MessageSquareText, messages: Inbox, blocked: UserX,
  announcements: Megaphone, activities: Images, policies: ScrollText, members: Users, advisors: GraduationCap,
  banners: GalleryHorizontal, consent: BadgeCheck, years: CalendarRange, roster: IdCard, users: UserCog, data: Database,
  setup: Settings, security: ShieldCheck, site: ExternalLink,
} satisfies Record<string, LucideIcon>;
export type NavIcon = keyof typeof NAV_ICONS;

export type NavItem = { href: string; label: string; icon: NavIcon; badge?: number; external?: boolean; yearScoped?: boolean };
export type NavGroup = { key: string; label: string | null; items: NavItem[] };

/** The item a path belongs to: the longest href that is the path or a parent of it ("/admin" only matches itself). */
export function activeItem(groups: NavGroup[], pathname: string): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (item.external) continue;
      const hit = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (hit && (!best || item.href.length > best.item.href.length)) best = { group, item };
    }
  }
  return best;
}
