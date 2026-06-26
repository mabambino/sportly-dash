import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, LayoutDashboard, Users, Calendar, ClipboardCheck, MessagesSquare,
  CreditCard, Megaphone, Bell, LogOut, BarChart3, User as UserIcon, Menu,
  Kanban, Layers, DollarSign, TrendingUp, Home, Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const adminNav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/members", label: "People", icon: Users },
  { to: "/app/schedule", label: "Schedule", icon: Calendar },
  { to: "/app/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/app/stats", label: "Stats", icon: BarChart3 },
  { to: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/app/groups", label: "Groups", icon: Layers },
  { to: "/app/revenue", label: "Revenue", icon: DollarSign },
  { to: "/app/progress", label: "Progress", icon: TrendingUp },
  { to: "/app/chat", label: "Chat", icon: MessagesSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/upcoming", label: "Upcoming", icon: Sparkles },
];

const memberNav = [
  { to: "/app/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/app/profile", label: "My profile", icon: UserIcon },
  { to: "/app/schedule", label: "Schedule", icon: Calendar },
  { to: "/app/chat", label: "Chat", icon: MessagesSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/upcoming", label: "Upcoming", icon: Sparkles },
];

const parentNav = [
  { to: "/app/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/app/parent", label: "My child", icon: Home },
  { to: "/app/schedule", label: "Schedule", icon: Calendar },
  { to: "/app/chat", label: "Chat", icon: MessagesSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/upcoming", label: "Upcoming", icon: Sparkles },
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
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  const nav = isStaff
    ? adminNav
    : membership.role === "parent"
      ? parentNav
      : memberNav;

  const NavList = () => (
    <nav className="space-y-1">
      {nav.map((item) => {
        const active = pathname === item.to;
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

  const TopBarActions = () => (
    <div className="flex items-center gap-1">
      <Link to="/app/announcements" title="Announcements">
        <Button variant="ghost" size="icon" className={cn(pathname === "/app/announcements" && "bg-accent")}>
          <Megaphone className="h-4 w-4" />
        </Button>
      </Link>
      <Link to="/app/notifications" title="Notifications">
        <Button variant="ghost" size="icon" className={cn(pathname === "/app/notifications" && "bg-accent")}>
          <Bell className="h-4 w-4" />
        </Button>
      </Link>
      <Link to="/app/settings" title="Settings">
        <Button variant="ghost" size="icon" className={cn(pathname === "/app/settings" && "bg-accent")}>
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </Link>
      <Button variant="ghost" size="icon" title="Sign out" onClick={signOut}>
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-hero text-primary-foreground"><Trophy className="h-3.5 w-3.5" /></div>
          <span className="font-display font-semibold">Syncletics</span>
        </div>
        <TopBarActions />
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 transition-transform lg:static lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-hero text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">Syncletics</span>
          </div>
          <div className="mb-4 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
            <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{club.sport}</p>
            <p className="mt-0.5 truncate font-semibold">{club.name}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Team code</span>
              <span className="rounded bg-background px-1.5 py-0.5 font-mono text-xs font-semibold">{club.team_code}</span>
            </div>
          </div>
          <NavList />
          <div className="mt-auto flex items-center gap-2 rounded-lg px-2 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.display_name}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{membership.role.replace("_", " ")}</p>
            </div>
          </div>
        </aside>

        {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

        <main className="min-h-screen flex-1 lg:ml-0">
          {/* Desktop top bar */}
          <header className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur lg:flex">
            <Badge variant="outline" className="font-mono text-xs">Code: {club.team_code}</Badge>
            <TopBarActions />
          </header>
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
