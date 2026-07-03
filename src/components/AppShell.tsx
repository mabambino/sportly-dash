import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Users, Calendar, ClipboardCheck, MessagesSquare,
  CreditCard, Megaphone, Bell, LogOut, BarChart3, User as UserIcon, Menu, Kanban, Layers,
  GraduationCap, TrendingUp, UserPlus, Upload, LineChart, Settings, QrCode,
} from "lucide-react";
import logoSyncletics from "@/assets/logo-syncletics.svg";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EnrollQRDialog } from "@/components/EnrollQRDialog";

type NavItem = { to: string; label: string; icon: typeof Users };
type NavSection = { label: string | null; items: NavItem[] };

const adminSections: NavSection[] = [
  {
    label: null,
    items: [{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { to: "/app/members", label: "Members", icon: Users },
      { to: "/app/groups", label: "Groups", icon: Layers },
      { to: "/app/courses", label: "Courses", icon: GraduationCap },
      { to: "/app/progress", label: "Progress", icon: LineChart },
      { to: "/app/import", label: "Import", icon: Upload },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/app/schedule", label: "Schedule", icon: Calendar },
      { to: "/app/attendance", label: "Attendance", icon: ClipboardCheck },
      { to: "/app/stats", label: "Stats", icon: BarChart3 },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/app/billing", label: "Billing", icon: CreditCard },
      { to: "/app/revenue", label: "Revenue", icon: TrendingUp },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: "/app/leads", label: "Leads", icon: UserPlus },
      { to: "/app/pipeline", label: "Pipeline", icon: Kanban },
    ],
  },
  {
    label: "Communication",
    items: [
      { to: "/app/chat", label: "Chat", icon: MessagesSquare },
      { to: "/app/announcements", label: "Announcements", icon: Megaphone },
      { to: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/app/settings", label: "Settings", icon: Settings },
      { to: "/app/profile", label: "My profile", icon: UserIcon },
    ],
  },
];

const memberSections: NavSection[] = [
  {
    label: null,
    items: [
      { to: "/app/dashboard", label: "Home", icon: LayoutDashboard },
      { to: "/app/profile", label: "My profile", icon: UserIcon },
      { to: "/app/schedule", label: "Schedule", icon: Calendar },
      { to: "/app/chat", label: "Chat", icon: MessagesSquare },
      { to: "/app/billing", label: "Billing", icon: CreditCard },
      { to: "/app/announcements", label: "Announcements", icon: Megaphone },
      { to: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, membership, club, isStaff, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
    if (!loading && user && !membership) navigate({ to: "/onboarding" });
  }, [loading, user, membership, navigate]);

  if (loading || !user || !membership || !club) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  const sections = isStaff ? adminSections : memberSections;

  const NavList = () => (
    <nav className="space-y-4">
      {sections.map((section, i) => (
        <div key={section.label ?? i}>
          {section.label && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.label}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/app/dashboard" className="flex items-center">
            <img src={logoSyncletics} alt="Syncletics" className="h-6 w-auto dark:invert-0 invert" />
          </Link>
        </div>
        <Badge variant="outline" className="font-mono text-xs">{club.team_code}</Badge>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 transition-transform lg:static lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Link to="/app/dashboard" className="mb-6 flex items-center gap-2 px-2">
            <img src={logoSyncletics} alt="Syncletics" className="h-7 w-auto" />
          </Link>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="group mb-6 w-full rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-left transition-colors hover:bg-sidebar-accent hover:border-primary/40"
            title="Show enrollment QR codes"
          >
            <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{club.sport}</p>
            <p className="mt-0.5 truncate font-semibold">{club.name}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <QrCode className="h-3 w-3" /> Team code
              </span>
              <span className="rounded bg-background px-1.5 py-0.5 font-mono text-xs font-semibold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{club.team_code}</span>
            </div>
          </button>
          <NavList />
          <div className="mt-auto space-y-3 pt-4">
            <div className="flex items-center gap-2 rounded-lg px-2 py-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{profile?.display_name}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">{membership.role.replace("_", " ")}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </aside>

        {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

        <main className="min-h-screen flex-1 lg:ml-0">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-10">{children}</div>
        </main>
      </div>
      <EnrollQRDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        clubId={club.id}
        clubName={club.name}
        teamCode={club.team_code}
      />
    </div>
  );
}
