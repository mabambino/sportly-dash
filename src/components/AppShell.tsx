import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useI18n, LANGUAGES, type LangCode } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Trophy, LayoutDashboard, Users, Calendar, ClipboardCheck, MessagesSquare,
  CreditCard, Megaphone, Bell, LogOut, BarChart3, User as UserIcon, Menu, Kanban, Layers,
  Sun, Moon, Settings, Languages, QrCode,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EnrollQRDialog } from "@/components/EnrollQRDialog";

const adminNav = [
  { to: "/app/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/app/members", key: "nav.members", icon: Users },
  { to: "/app/schedule", key: "nav.schedule", icon: Calendar },
  { to: "/app/attendance", key: "nav.attendance", icon: ClipboardCheck },
  { to: "/app/stats", key: "nav.stats", icon: BarChart3 },
  { to: "/app/pipeline", key: "nav.pipeline", icon: Kanban },
  { to: "/app/groups", key: "nav.groups", icon: Layers },
  { to: "/app/chat", key: "nav.chat", icon: MessagesSquare },
  { to: "/app/billing", key: "nav.billing", icon: CreditCard },
  { to: "/app/announcements", key: "nav.announcements", icon: Megaphone },
];

const memberNav = [
  { to: "/app/dashboard", key: "nav.home", icon: LayoutDashboard },
  { to: "/app/profile", key: "nav.profile", icon: UserIcon },
  { to: "/app/schedule", key: "nav.schedule", icon: Calendar },
  { to: "/app/chat", key: "nav.chat", icon: MessagesSquare },
  { to: "/app/billing", key: "nav.billing", icon: CreditCard },
  { to: "/app/announcements", key: "nav.announcements", icon: Megaphone },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, membership, club, isStaff, profile, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
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

  const nav = isStaff ? adminNav : memberNav;
  const currentLang = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

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
            <item.icon className="h-4 w-4" /> {t(item.key)}
          </Link>
        );
      })}
      <Link
        to="/app/notifications"
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          pathname === "/app/notifications" ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <Bell className="h-4 w-4" /> {t("nav.notifications")}
      </Link>
      <Link
        to="/app/settings"
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          pathname === "/app/settings" ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <Settings className="h-4 w-4" /> {t("nav.settings")}
      </Link>
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
          <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-hero text-primary-foreground"><Trophy className="h-3.5 w-3.5" /></div>
          <span className="font-display font-semibold">{club.name}</span>
        </div>
        <Badge variant="outline" className="font-mono text-xs">{club.team_code}</Badge>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 transition-transform lg:static lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Link to="/" className="mb-6 flex items-center gap-2 px-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-hero text-primary-foreground"><Trophy className="h-4 w-4" /></div>
            <span className="font-display font-semibold">ClubHaus</span>
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
                <QrCode className="h-3 w-3" /> {t("common.teamCode")}
              </span>
              <span className="rounded bg-background px-1.5 py-0.5 font-mono text-xs font-semibold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{club.team_code}</span>
            </div>
          </button>
          <NavList />
          <div className="mt-auto space-y-3 pt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                title={resolvedTheme === "dark" ? t("theme.light") : t("theme.dark")}
                aria-label="Toggle dark mode"
              >
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 flex-1 justify-start gap-2" aria-label={t("common.language")}>
                    <Languages className="h-3.5 w-3.5" />
                    <span className="text-xs">{currentLang.flag} {currentLang.label}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {LANGUAGES.map((l) => (
                    <DropdownMenuItem
                      key={l.code}
                      onClick={() => setLang(l.code as LangCode)}
                      className={cn("gap-2", lang === l.code && "bg-accent font-medium")}
                    >
                      <span>{l.flag}</span> {l.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
              <LogOut className="mr-2 h-3.5 w-3.5" /> {t("common.signOut")}
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
