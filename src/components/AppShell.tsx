import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Trophy, LayoutDashboard, Users, Calendar, ClipboardCheck, MessagesSquare,
  CreditCard, Megaphone, Bell, LogOut, BarChart3, User as UserIcon, Menu,
  Kanban, Layers, DollarSign, TrendingUp, Home, Settings as SettingsIcon,
  Search, Mail, GraduationCap, Upload, GripVertical,
} from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/logo-syncletics.svg";

const adminNav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/members", label: "People", icon: Users },
  { to: "/app/schedule", label: "Schedule", icon: Calendar },
  { to: "/app/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/app/stats", label: "Stats", icon: BarChart3 },
  { to: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/app/groups", label: "Groups", icon: Layers },
  { to: "/app/courses", label: "Courses", icon: GraduationCap },
  { to: "/app/revenue", label: "Revenue", icon: DollarSign },
  { to: "/app/progress", label: "Progress", icon: TrendingUp },
  { to: "/app/chat", label: "Chat", icon: MessagesSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/import", label: "Import", icon: Upload },
];

const memberNav = [
  { to: "/app/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/app/profile", label: "My profile", icon: UserIcon },
  { to: "/app/schedule", label: "Schedule", icon: Calendar },
  { to: "/app/chat", label: "Chat", icon: MessagesSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
];

const parentNav = [
  { to: "/app/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/app/parent", label: "My child", icon: Home },
  { to: "/app/schedule", label: "Schedule", icon: Calendar },
  { to: "/app/chat", label: "Chat", icon: MessagesSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, membership, club, isStaff, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
    if (!loading && user && !membership) navigate({ to: "/onboarding" });
  }, [loading, user, membership, navigate]);

  if (loading || !user || !membership || !club) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loadingâ¦</div>;
  }

  const nav = isStaff
    ? adminNav
    : membership.role === "parent"
      ? parentNav
      : memberNav;

  // --- Reorderable navigation ---
  const navKey = isStaff
    ? "admin"
    : membership.role === "parent"
      ? "parent"
      : "member";
  const storageKey = "nav-order-" + navKey;
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(saved)) return saved as string[];
    } catch {}
    return nav.map((i) => i.to);
  });
  const dragItem = useRef<string | null>(null);

  // Keep order in sync with the available items (new tabs appended, stale removed).
  const orderedNav = (() => {
    const known = new Set(nav.map((i) => i.to));
    const ordered = order.filter((to) => known.has(to));
    for (const item of nav) if (!ordered.includes(item.to)) ordered.push(item.to);
    return ordered
      .map((to) => nav.find((i) => i.to === to))
      .filter(Boolean) as typeof nav;
  })();

  const persistOrder = (next: string[]) => {
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  const onDropItem = (targetTo: string) => {
    const from = dragItem.current;
    dragItem.current = null;
    if (!from || from === targetTo) return;
    const current = orderedNav.map((i) => i.to);
    const next = current.filter((to) => to !== from);
    const targetIdx = next.indexOf(targetTo);
    next.splice(targetIdx, 0, from);
    persistOrder(next);
  };

  const resetOrder = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setOrder(nav.map((i) => i.to));
  };

  const NavList = () => (
    <nav className="space-y-1">
      <div className="mb-1 flex items-center justify-between px-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Menu
        </span>
        <button
          type="button"
          onClick={() => setReordering((r) => !r)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {reordering ? "Done" : "Edit"}
        </button>
      </div>
      {reordering && (
        <button
          type="button"
          onClick={resetOrder}
          className="mb-1 px-3 text-xs text-muted-foreground hover:text-foreground"
        >
          Reset order
        </button>
      )}
      {orderedNav.map((item) => {
        const active = pathname === item.to;
        if (reordering) {
          return (
            <div
              key={item.to}
              draggable
              onDragStart={() => (dragItem.current = item.to)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropItem(item.to)}
              className={cn(
                "flex cursor-grab items-center gap-3 rounded-lg border border-dashed border-sidebar-border px-3 py-2 text-sm font-medium active:cursor-grabbing",
                active ? "bg-primary/10 text-primary" : "text-sidebar-foreground"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <item.icon className="h-4 w-4" /> {item.label}
            </div>
          );
        }
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const TopBarActions = ({ compact = false }: { compact?: boolean }) => (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <Link to="/app/chat" title="Messages" className={cn(compact && "hidden sm:inline-flex")}>
        <Button variant="ghost" size="icon" className={cn("rounded-full h-9 w-9", pathname === "/app/chat" && "bg-accent")}>
          <Mail className="h-4 w-4" />
        </Button>
      </Link>
      <Link to="/app/announcements" title="Announcements" className={cn(compact && "hidden sm:inline-flex")}>
        <Button variant="ghost" size="icon" className={cn("h-9 w-9", pathname === "/app/announcements" && "bg-accent")}>
          <Megaphone className="h-4 w-4" />
        </Button>
      </Link>
      <Link to="/app/notifications" title="Notifications">
        <Button variant="ghost" size="icon" className={cn("h-9 w-9", pathname === "/app/notifications" && "bg-accent")}>
          <Bell className="h-4 w-4" />
        </Button>
      </Link>
      <Link to="/app/settings" title="Settings">
        <Button variant="ghost" size="icon" className={cn("h-9 w-9", pathname === "/app/settings" && "bg-accent")}>
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </Link>
      <Button variant="ghost" size="icon" className="h-9 w-9" title="Sign out" onClick={signOut}>
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/app/dashboard" onClick={() => setMobileOpen(false)} aria-label="Go to dashboard">
            <img src={logoUrl} alt="Syncletics" className="h-6 w-auto shrink-0" />
          </Link>
        </div>
        <TopBarActions compact />
      </header>

      <div className="flex min-w-0">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 transition-transform lg:static lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-4 flex items-center justify-center">
            <Link to="/app/dashboard" aria-label="Go to dashboard">
              <img src={logoUrl} alt="Syncletics" className="h-8 w-auto" />
            </Link>
          </div>
          <div className="mb-4 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
            <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{club.sport}</p>
            <p className="mt-0.5 truncate font-semibold">{club.name}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Team code</span>
              <span className="rounded bg-background px-1.5 py-0.5 font-mono text-xs font-semibold">{club.team_code}</span>
            </div>
          </div>
          <NavList />
          <div className="mt-auto flex items-center gap-2 rounded-lg px-2 py-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.display_name}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{membership.role.replace("_", " ")}</p>
            </div>
          </div>
        </aside>

        {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

        <main className="min-h-screen w-full min-w-0 flex-1 overflow-x-hidden lg:ml-0">
          {/* Desktop top bar */}
          <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur lg:flex">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search task"
                className="h-10 w-full rounded-full border border-border bg-secondary/60 pl-10 pr-16 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground">&#8984; F</kbd>
            </div>
            <div className="flex items-center gap-3">
              <TopBarActions />
              <div className="flex items-center gap-3 border-l border-border pl-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="hidden min-w-0 leading-tight xl:block">
                  <p className="truncate text-sm font-semibold">{profile?.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </div>
          </header>
          <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-5 sm:px-4 sm:py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
