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
  LayoutDashboard, Users, Calendar, ClipboardCheck, MessagesSquare,
  CreditCard, Megaphone, Bell, LogOut, BarChart3, User as UserIcon, Menu, Kanban, Layers,
  GraduationCap, TrendingUp, UserPlus, Upload, LineChart, Settings, QrCode, Search, Mail,
  Sun, Moon, Languages,
} from "lucide-react";
import logoSyncletics from "@/assets/logo-syncletics.svg";
import logoSyncleticsWhite from "@/assets/logo-syncletics-white.svg";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EnrollQRDialog } from "@/components/EnrollQRDialog";
import { useAvatar } from "@/lib/user-settings";


type NavItem = { to: string; labelKey: string; icon: typeof Users };
type NavSection = { labelKey: string | null; items: NavItem[] };

const adminSections: NavSection[] = [
  {
    labelKey: null,
    items: [{ to: "/app/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "sec.people",
    items: [
      { to: "/app/members", labelKey: "nav.members", icon: Users },
      { to: "/app/groups", labelKey: "nav.groups", icon: Layers },
      { to: "/app/courses", labelKey: "nav.courses", icon: GraduationCap },
      { to: "/app/progress", labelKey: "nav.progress", icon: LineChart },
      { to: "/app/import", labelKey: "nav.import", icon: Upload },
    ],
  },
  {
    labelKey: "sec.operations",
    items: [
      { to: "/app/schedule", labelKey: "nav.schedule", icon: Calendar },
      { to: "/app/attendance", labelKey: "nav.attendance", icon: ClipboardCheck },
      { to: "/app/stats", labelKey: "nav.stats", icon: BarChart3 },
    ],
  },
  {
    labelKey: "sec.money",
    items: [
      { to: "/app/billing", labelKey: "nav.billing", icon: CreditCard },
      { to: "/app/revenue", labelKey: "nav.revenue", icon: TrendingUp },
    ],
  },
  {
    labelKey: "sec.growth",
    items: [
      { to: "/app/leads", labelKey: "nav.leads", icon: UserPlus },
      { to: "/app/pipeline", labelKey: "nav.pipeline", icon: Kanban },
    ],
  },
  {
    labelKey: "sec.communication",
    items: [
      { to: "/app/chat", labelKey: "nav.chat", icon: MessagesSquare },
      { to: "/app/announcements", labelKey: "nav.announcements", icon: Megaphone },
      { to: "/app/notifications", labelKey: "nav.notifications", icon: Bell },
    ],
  },
  {
    labelKey: "sec.account",
    items: [
      { to: "/app/settings", labelKey: "nav.settings", icon: Settings },
      { to: "/app/profile", labelKey: "nav.profile", icon: UserIcon },
    ],
  },
];

const memberSections: NavSection[] = [
  {
    labelKey: null,
    items: [
      { to: "/app/dashboard", labelKey: "nav.home", icon: LayoutDashboard },
      { to: "/app/profile", labelKey: "nav.profile", icon: UserIcon },
      { to: "/app/schedule", labelKey: "nav.schedule", icon: Calendar },
      { to: "/app/chat", labelKey: "nav.chat", icon: MessagesSquare },
      { to: "/app/billing", labelKey: "nav.billing", icon: CreditCard },
      { to: "/app/announcements", labelKey: "nav.announcements", icon: Megaphone },
      { to: "/app/notifications", labelKey: "nav.notifications", icon: Bell },
    ],
  },
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

  const sections = isStaff ? adminSections : memberSections;
  const currentLang = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  const ThemeToggle = ({ className }: { className?: string }) => (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn("grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground", className)}
      aria-label="Toggle dark mode"
      title={resolvedTheme === "dark" ? t("theme.light") : t("theme.dark")}
    >
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );

  const LanguageMenu = ({ compact }: { compact?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={t("common.language")}
            title={t("common.language")}
          >
            <Languages className="h-4 w-4" />
          </button>
        ) : (
          <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2" aria-label={t("common.language")}>
            <Languages className="h-3.5 w-3.5" />
            <span className="text-xs">{currentLang.flag} {currentLang.label}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
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
  );

  const UserBubble = ({ size, fallbackClass }: { size: string; fallbackClass: string }) => {
    const avatar = useAvatar(user.id, profile?.avatar_url ?? null);
    const initial = profile?.display_name?.[0]?.toUpperCase() ?? "?";
    return avatar ? (
      <img src={avatar} alt={profile?.display_name ?? "Profile"} className={cn(size, "shrink-0 rounded-full object-cover")} />
    ) : (
      <div className={cn(size, "grid shrink-0 place-items-center rounded-full", fallbackClass)}>{initial}</div>
    );
  };

  const NavList = () => (
    <nav className="space-y-4">
      {sections.map((section, i) => (
        <div key={section.labelKey ?? i}>
          {section.labelKey && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t(section.labelKey)}
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
                  <item.icon className="h-4 w-4" /> {t(item.labelKey)}
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
            <img src={logoSyncletics} alt="Syncletics" className="h-6 w-auto dark:hidden" />
            <img src={logoSyncleticsWhite} alt="Syncletics" className="hidden h-6 w-auto dark:block" />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Badge variant="outline" className="font-mono text-xs">{club.team_code}</Badge>
        </div>
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
            <img src={logoSyncletics} alt="Syncletics" className="h-7 w-auto dark:hidden" />
            <img src={logoSyncleticsWhite} alt="Syncletics" className="hidden h-7 w-auto dark:block" />
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
          {/* Account controls belong in the mobile drawer. On desktop the same
              actions are available from the top bar and account pages. */}
          <div className="mt-auto space-y-3 pt-4 lg:hidden">
            <LanguageMenu />
            <div className="flex items-center gap-2 rounded-lg px-2 py-2">
              <UserBubble size="h-8 w-8" fallbackClass="bg-primary/10 text-xs font-semibold text-primary" />
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
          {/* Desktop top bar */}
          <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur lg:flex xl:px-8">
            <div className="relative flex-1 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("common.search")}
                className="h-10 rounded-full border-border bg-muted/40 pl-9 pr-16 focus-visible:ring-1"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
                ⌘ F
              </kbd>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <LanguageMenu compact />
              <Link to="/app/chat" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Messages">
                <Mail className="h-4 w-4" />
              </Link>
              <Link to="/app/announcements" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Announcements">
                <Megaphone className="h-4 w-4" />
              </Link>
              <Link to="/app/notifications" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </Link>
              <Link to="/app/settings" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Link>
              <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <Link to="/app/profile" className="flex items-center gap-3 rounded-full border border-border py-1 pl-1 pr-4 transition hover:bg-muted">
              <UserBubble size="h-8 w-8" fallbackClass="bg-primary text-xs font-semibold text-primary-foreground" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-bold uppercase tracking-wider">{profile?.display_name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            </Link>
          </header>
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
