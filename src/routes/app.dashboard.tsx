import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { SensitiveValue } from "@/components/SensitiveValue";
import { usePrivacy } from "@/lib/user-settings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowUpRight, Users, DollarSign, TrendingUp,
  UserPlus, Upload, GripVertical, Check, Bell, CalendarDays, Play, Pause, Square, Save, Eye, EyeOff,
  Zap, CreditCard, CalendarPlus, Megaphone, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { format, subDays, endOfDay, startOfMonth, startOfYear } from "date-fns";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Syncletics" }] }),
  component: Dashboard,
});

// Card ids must match the names used in Settings → Dashboard so the saved
// order/layout preferences apply here.
const DEFAULT_CARD_ORDER = [
  "Total Members",
  "Attendance Rate",
  "Upcoming Sessions",
  "Monthly Revenue",
];

const DEFAULT_WIDGET_ORDER = [
  ...DEFAULT_CARD_ORDER,
  "Club Analytics",
  "Reminders",
  "Attendance Progress",
  "Time Tracker",
  "Announcements",
];

const WIDGET_SIZES: Record<string, string> = {
  "Total Members": "lg:col-span-3",
  "Attendance Rate": "lg:col-span-3",
  "Upcoming Sessions": "lg:col-span-3",
  "Monthly Revenue": "lg:col-span-3",
  "Club Analytics": "col-span-2 lg:col-span-8",
  "Reminders": "col-span-2 lg:col-span-4",
  "Attendance Progress": "col-span-2 lg:col-span-4",
  "Time Tracker": "col-span-2 lg:col-span-4",
  "Announcements": "col-span-2 lg:col-span-4",
};

function Dashboard() {
  const { club, isStaff, profile, refresh } = useAuth();
  const { hideAll, toggle: togglePrivacy } = usePrivacy();
  const [isRearranging, setIsRearranging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    enabled: !!club,
    queryKey: ["dashboard", club?.id],
    queryFn: async () => {
      const [members, slots, monthPayments, attTotal, attPresent, ann] = await Promise.all([
        supabase.from("memberships").select("role, joined_at").eq("club_id", club!.id),
        supabase.from("time_slots").select("*").eq("club_id", club!.id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
        supabase.from("payments").select("amount_cents, status, period_month").eq("club_id", club!.id).gte("period_month", format(startOfYear(new Date()), "yyyy-MM-dd")),
        supabase.from("attendance_records").select("id, time_slots!inner(club_id)", { count: "exact", head: true }).eq("time_slots.club_id", club!.id),
        supabase.from("attendance_records").select("id, time_slots!inner(club_id)", { count: "exact", head: true }).eq("time_slots.club_id", club!.id).eq("status", "present"),
        supabase.from("announcements").select("*").eq("club_id", club!.id).order("created_at", { ascending: false }).limit(3),
      ]);
      const firstError = members.error || slots.error || monthPayments.error || ann.error;
      if (firstError) throw firstError;
      return {
        members: members.data || [],
        slots: slots.data || [],
        monthPayments: monthPayments.data || [],
        attTotal: attTotal.count ?? 0,
        attPresent: attPresent.count ?? 0,
        ann: ann.data || [],
      };
    },
  });

  const members = data?.members || [];
  const students = members.filter((m) => m.role === "student");
  const attRate = data?.attTotal ? Math.round((data.attPresent / data.attTotal) * 100) : 0;
  const monthStartStr = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const paidThisMonth = (data?.monthPayments || []).filter((p) => p.status === "paid" && p.period_month >= monthStartStr);
  const revenueThisMonth = paidThisMonth.reduce((s, p) => s + p.amount_cents, 0) / 100;
  const [revPeriod, setRevPeriod] = useState<"month" | "quarter" | "year">("month");
  const revPeriodStart = (() => {
    const now = new Date();
    if (revPeriod === "month") return monthStartStr;
    if (revPeriod === "quarter") return format(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), "yyyy-MM-dd");
    return format(startOfYear(now), "yyyy-MM-dd");
  })();
  const periodPayments = (data?.monthPayments || []).filter((p) => p.period_month >= revPeriodStart);
  const revCollected = periodPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_cents, 0) / 100;
  const revOutstanding = periodPayments.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount_cents, 0) / 100;
  const revOverdue = periodPayments.filter((p) => p.status === "overdue").length;

  const growth = useMemo(() => {
    const days = 7;
    return Array.from({ length: days }, (_, i) => {
      const d = endOfDay(subDays(new Date(), days - 1 - i));
      return {
        day: format(d, "EEE"),
        members: members.filter((m) => new Date(m.joined_at) <= d).length,
      };
    });
  }, [members]);

  // Respect the card order + layout saved in Settings → Dashboard.
  const prefs = (profile?.dashboard_prefs ?? {}) as { order?: string[]; layout?: string };
  const normalizedOrder = useMemo(() => {
    const order = Array.isArray(prefs.order) && prefs.order.length ? prefs.order : DEFAULT_CARD_ORDER;
    return [
      ...order.filter((card) => DEFAULT_WIDGET_ORDER.includes(card)),
      ...DEFAULT_WIDGET_ORDER.filter((card) => !order.includes(card)),
    ];
  }, [profile?.dashboard_prefs]);
  const [cardOrder, setCardOrder] = useState<string[]>(normalizedOrder);

  useEffect(() => {
    if (isRearranging || !profile?.id) return;
    const key = `syncletics-dashboard-order:${profile.id}`;
    try {
      const local = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(local)) {
        setCardOrder([
          ...local.filter((card) => DEFAULT_WIDGET_ORDER.includes(card)),
          ...DEFAULT_WIDGET_ORDER.filter((card) => !local.includes(card)),
        ]);
        return;
      }
    } catch { /* Fall back to the cloud/default order. */ }
    setCardOrder(normalizedOrder);
  }, [normalizedOrder, isRearranging, profile?.id]);

  const moveCard = async (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex || !profile?.id) {
      setDragIndex(null);
      return;
    }
    const next = [...cardOrder];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setCardOrder(next);
    setDragIndex(null);

    // Always persist per user on this device. Cloud sync is best-effort so
    // older deployments without dashboard_prefs still retain the arrangement.
    localStorage.setItem(`syncletics-dashboard-order:${profile.id}`, JSON.stringify(next));

    const { error } = await supabase
      .from("profiles")
      .update({ dashboard_prefs: { ...prefs, order: next } } as any)
      .eq("id", profile.id);
    if (error) {
      return;
    }
    await refresh();
  };

  // Touch-friendly reordering for mobile, where HTML5 drag-and-drop does not fire.
  const moveCardBy = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= cardOrder.length || !profile?.id) return;
    const next = [...cardOrder];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setCardOrder(next);
    localStorage.setItem("syncletics-dashboard-order:" + profile.id, JSON.stringify(next));
    const { error } = await supabase
      .from("profiles")
      .update({ dashboard_prefs: { ...prefs, order: next } } as any)
      .eq("id", profile.id);
    if (error) {
      return;
    }
    await refresh();
  };
  const STAT_CARDS: Record<string, { label: string; value: string | number; sub: string; subIcon?: typeof Users; to: string; sensitive?: boolean }> = {
    "Total Members": {
      label: "Total Members",
      value: members.length,
      sub: `${students.length} students enrolled`,
      to: "/app/members",
    },
    "Attendance Rate": {
      label: "Attendance Rate",
      value: `${attRate}%`,
      sub: `Across ${data?.attTotal ?? 0} records`,
      subIcon: CalendarDays,
      to: "/app/attendance",
    },
    "Upcoming Sessions": {
      label: "Upcoming Sessions",
      value: data?.slots.length ?? 0,
      sub: "Next 7 days",
      subIcon: TrendingUp,
      to: "/app/schedule",
    },
    "Monthly Revenue": {
      label: "Monthly Revenue",
      value: `$${revenueThisMonth.toFixed(0)}`,
      sub: `$ ${paidThisMonth.length} paid`,
      subIcon: DollarSign,
      to: "/app/revenue",
      sensitive: true,
    },
  };
  const firstStatName = cardOrder.find((name) => DEFAULT_CARD_ORDER.includes(name));

  if (error) {
    return <Card className="p-8 text-center text-sm text-destructive">Could not load the dashboard: {(error as Error).message}</Card>;
  }

  if (!isStaff) return <MemberHome data={data} profile={profile} />;

  return (
    <div className="space-y-6">
      {/* Mobile hero: revenue summary */}
      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground lg:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/20"><DollarSign className="h-4 w-4" /></span>
          <p className="font-medium">Total Revenue</p>
        </div>
        <p className="mt-3 text-5xl font-bold tracking-tight">
          {hideAll ? <SensitiveValue mask="$ ••••">{`$${revCollected.toFixed(2)}`}</SensitiveValue> : `$${revCollected.toFixed(2)}`}
        </p>
        <div className="mt-4 flex gap-10 text-sm">
          <div><p className="text-primary-foreground/70">Outstanding</p><p className="mt-0.5 font-semibold">{hideAll ? "••••" : `$${revOutstanding.toFixed(2)}`}</p></div>
          <div><p className="text-primary-foreground/70">Overdue</p><p className="mt-0.5 font-semibold">{revOverdue}</p></div>
        </div>
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {([["month", "This Month"], ["quarter", "This Quarter"], ["year", "This Year"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRevPeriod(key)}
              className={"whitespace-nowrap rounded-full border border-primary-foreground/30 px-4 py-1.5 text-sm font-medium transition " + (revPeriod === key ? "bg-primary-foreground text-primary" : "text-primary-foreground/90 hover:bg-primary-foreground/10")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile quick actions */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          <h2 className="text-xl font-bold">Quick Actions</h2>
        </div>
        <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
          {([
            { to: "/app/billing", label: "New Invoice", icon: CreditCard },
            { to: "/app/schedule", label: "New Session", icon: CalendarPlus },
            { to: "/app/members", label: "New Member", icon: UserPlus },
            { to: "/app/announcements", label: "Announcement", icon: Megaphone },
          ] as const).map((qa) => (
            <Link key={qa.label} to={qa.to} className="flex w-36 shrink-0 flex-col items-center gap-3 rounded-2xl border border-border bg-card py-5 transition hover:border-primary/40">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-foreground"><qa.icon className="h-5 w-5" /></span>
              <span className="text-sm font-medium">{qa.label}</span>
            </Link>
          ))}
        </div>
      </div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="hidden min-w-0 lg:block">
          <p className="text-sm text-muted-foreground">Welcome back{profile ? `, ${profile.display_name.split(" ")[0]}` : ""}</p>
          <h1 className="mt-1 truncate text-3xl font-bold tracking-tight sm:text-4xl">{club?.name} Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your club, members, and sessions with ease.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button asChild className="rounded-full">
            <Link to="/app/members"><UserPlus className="mr-2 h-4 w-4" />Add Member</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/app/import"><Upload className="mr-2 h-4 w-4" />Import Data</Link>
          </Button>
          <Button
            variant={isRearranging ? "default" : "outline"}
            size="icon"
            className="rounded-full"
            onClick={() => { setIsRearranging((value) => !value); setDragIndex(null); }}
            aria-label={isRearranging ? "Finish rearranging dashboard cards" : "Rearrange dashboard cards"}
            title={isRearranging ? "Done rearranging" : "Rearrange cards"}
          >
            {isRearranging ? <Check className="h-4 w-4" /> : <GripVertical className="h-4 w-4" />}
          </Button>
          <Button
            variant={hideAll ? "default" : "outline"}
            size="icon"
            className="rounded-full"
            onClick={togglePrivacy}
            aria-label={hideAll ? "Show dashboard info" : "Hide dashboard info"}
            title={hideAll ? "Privacy on — dashboard info hidden" : "Privacy off — hide dashboard info"}
          >
            {hideAll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isStaff && !isLoading && students.length === 0 && (
        <div className="flex justify-end"><DemoSeedButton /></div>
      )}

      {/* Every dashboard widget participates in one persistent drag order. */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-12">
          {DEFAULT_WIDGET_ORDER.map((name) => (
            <Card key={name} className={`${WIDGET_SIZES[name]} p-6`}><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-10 w-20" /><Skeleton className="mt-4 h-3 w-24" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-12">
          {cardOrder.map((name, index) => {
            const c = STAT_CARDS[name];
            let content: ReactNode;
            if (c) {
              content = <StatCard label={c.label} value={c.value} sub={c.sub} subIcon={c.subIcon} to={c.to} sensitive={c.sensitive} filled={name === firstStatName} />;
            } else if (name === "Club Analytics") {
              content = (
                <Card className="h-full p-6">
                  <div className="flex items-center justify-between"><p className="text-lg font-semibold">Club Analytics</p><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Last 7 days</span></div>
                  <div className="mt-6 h-72">
                    <ResponsiveContainer width="100%" height="100%"><AreaChart data={growth}>
                      <defs><linearGradient id="analytics-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} /><XAxis dataKey="day" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} /><YAxis stroke="currentColor" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} /><Area dataKey="members" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#analytics-fill)" />
                    </AreaChart></ResponsiveContainer>
                  </div>
                </Card>
              );
            } else if (name === "Reminders") {
              content = (
                <Card className="h-full p-6"><div className="flex items-center gap-2"><Bell className="h-5 w-5" /><p className="text-lg font-semibold">Reminders</p></div><div className="mt-6 space-y-3">
                  {(data?.slots.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No upcoming sessions scheduled.</p> : data!.slots.slice(0, 4).map((s) => <div key={s.id} className="rounded-lg border border-border p-3"><p className="truncate text-sm font-medium">{s.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{format(new Date(s.starts_at), "EEE MMM d, h:mm a")}</p></div>)}
                </div></Card>
              );
            } else if (name === "Attendance Progress") {
              content = <AttendanceProgressCard present={data?.attPresent ?? 0} total={data?.attTotal ?? 0} rate={attRate} />;
            } else if (name === "Time Tracker") {
              content = <TimeTrackerCard />;
            } else {
              content = (
                <Card className="h-full p-6"><div className="flex items-center justify-between"><p className="text-lg font-semibold">Announcements</p><Link to="/app/announcements" className="text-xs font-medium text-muted-foreground hover:text-foreground">View all</Link></div><div className="mt-4 space-y-4">
                  {(data?.ann.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No announcements yet.</p> : data!.ann.map((a) => <div key={a.id} className="border-b border-border pb-3 last:border-0 last:pb-0"><p className="text-sm font-medium">{a.title}</p><p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p></div>)}
                </div></Card>
              );
            }
            return (
              <DashboardWidget
                key={name}
                className={WIDGET_SIZES[name]}
                rearranging={isRearranging}
                dragging={dragIndex === index}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  setDragIndex(index);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void moveCard(index)}
                onDragEnd={() => setDragIndex(null)}
                onMoveUp={() => void moveCardBy(index, -1)}
                onMoveDown={() => void moveCardBy(index, 1)}
                canMoveUp={index > 0}
                canMoveDown={index < cardOrder.length - 1}
              >
                {content}
              </DashboardWidget>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardWidget({
  children, className, rearranging, dragging, onDragStart, onDragOver, onDrop, onDragEnd, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: {
  children: ReactNode;
  className?: string;
  rearranging?: boolean;
  dragging?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  return (
    <div
      draggable={rearranging}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`${className ?? ""} relative h-full transition ${rearranging ? "cursor-grab select-none rounded-xl ring-2 ring-primary active:cursor-grabbing" : ""} ${dragging ? "scale-[0.98] opacity-50" : ""}`}
    >
      {rearranging && <span className="absolute right-3 top-3 z-20 hidden h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow lg:grid"><GripVertical className="h-4 w-4" /></span>}
      {rearranging && (
        <div className="absolute right-3 top-3 z-20 flex gap-1.5 lg:hidden">
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-40" aria-label="Move up">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-40" aria-label="Move down">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className={`h-full ${rearranging ? "pointer-events-none" : ""}`}>{children}</div>
    </div>
  );
}

function StatCard({
  label, value, sub, subIcon: SubIcon, to, filled, sensitive,
}: {
  label: string;
  value: string | number;
  sub: string;
  subIcon?: typeof Users;
  to: string;
  filled?: boolean;
  sensitive?: boolean;
}) {
  const { hideAll } = usePrivacy();
  const masked = sensitive || hideAll;
  return (
    <Card className={"relative h-full overflow-hidden p-6 " + (filled ? "border-transparent bg-primary text-primary-foreground" : "")}>
      <div className="flex items-start justify-between">
        <p className={"text-[11px] font-semibold uppercase tracking-widest " + (filled ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {label}
        </p>
        <Link
            to={to}
            className={
              "grid h-8 w-8 place-items-center rounded-full transition " +
              (filled
                ? "bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
                : "bg-muted text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground")
            }
            aria-label={`Open ${label}`}
          >
            <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="mt-6 text-4xl font-bold tracking-tight">
        {masked ? <SensitiveValue mask={sensitive ? "$ ••••" : "••••"}>{value}</SensitiveValue> : value}
      </p>
      <div className={"mt-4 flex items-center gap-1.5 text-xs " + (filled ? "text-primary-foreground/70" : "text-muted-foreground")}>
        {SubIcon && <SubIcon className="h-3.5 w-3.5" />}
        <span>{sub}</span>
      </div>
    </Card>
  );
}

function AttendanceProgressCard({ present, total, rate }: { present: number; total: number; rate: number }) {
  const chartData = [{ name: "rate", value: rate, fill: "var(--color-chart-3)" }];
  return (
    <Card className="h-full p-6">
      <p className="text-lg font-semibold">Attendance Progress</p>
      <div className="relative mx-auto mt-6 h-36 w-full max-w-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="72%"
            outerRadius="100%"
            data={chartData}
            startAngle={180}
            endAngle={0}
            cy="100%"
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "var(--color-muted)" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
          <p className="text-4xl font-bold leading-none tabular-nums">{rate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">Present rate</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-chart-3" />Present ({present})</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" />Total ({total})</span>
      </div>
    </Card>
  );
}

type TimeEntry = { id: string; memberId: string; memberName: string; ms: number; note: string; savedAt: string };

function formatDuration(ms: number) {
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  return `${hh > 0 ? `${hh}h ` : ""}${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
}

function TimeTrackerCard() {
  const { club } = useAuth();
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  const [saveOpen, setSaveOpen] = useState(false);
  const [memberId, setMemberId] = useState<string>("");
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  const entriesKey = club ? `syncletics-time-entries:${club.id}` : null;

  // Load previously saved entries for this club.
  useEffect(() => {
    if (!entriesKey) return;
    try {
      const raw = JSON.parse(localStorage.getItem(entriesKey) || "null");
      if (Array.isArray(raw)) setEntries(raw);
    } catch {
      /* ignore */
    }
  }, [entriesKey]);

  // Club members the tracked time can be attributed to.
  const { data: members } = useQuery({
    enabled: !!club,
    queryKey: ["time-tracker-members", club?.id],
    queryFn: async () => {
      const { data: mems } = await supabase.from("memberships").select("user_id").eq("club_id", club!.id);
      const ids = (mems || []).map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (mems || []).map((m) => ({
        id: m.user_id,
        name: profs?.find((p) => p.id === m.user_id)?.display_name || "Member",
      }));
    },
  });

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = window.setInterval(() => {
      setMs(baseRef.current + (Date.now() - (startRef.current ?? Date.now())));
    }, 30);
    return () => window.clearInterval(id);
  }, [running]);

  const toggle = () => {
    if (running) {
      baseRef.current = ms;
      setRunning(false);
    } else {
      setRunning(true);
    }
  };
  const reset = () => {
    setRunning(false);
    baseRef.current = 0;
    setMs(0);
  };

  const openSave = () => {
    // Pause so the saved duration is stable while the dialog is open.
    if (running) {
      baseRef.current = ms;
      setRunning(false);
    }
    setSaveOpen(true);
  };

  const saveEntry = () => {
    if (!entriesKey) return;
    if (!memberId) { toast.error("Choose a member to add this time to"); return; }
    if (ms <= 0) { toast.error("Track some time before saving"); return; }
    const member = (members || []).find((m) => m.id === memberId);
    const entry: TimeEntry = {
      id: `${Date.now()}`,
      memberId,
      memberName: member?.name || "Member",
      ms,
      note: note.trim(),
      savedAt: new Date().toISOString(),
    };
    const next = [entry, ...entries].slice(0, 50);
    setEntries(next);
    try {
      localStorage.setItem(entriesKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    toast.success(`Added ${formatDuration(ms)} to ${entry.memberName}`);
    setSaveOpen(false);
    setNote("");
    setMemberId("");
    reset();
  };

  const total = ms;
  const hh = String(Math.floor(total / 3600000)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600000) / 60000)).padStart(2, "0");
  const ss = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
  const cs = String(Math.floor((total % 1000) / 10)).padStart(2, "0");

  return (
    <Card className="flex h-full flex-col border-transparent bg-primary p-6 text-primary-foreground">
      <p className="text-lg font-semibold">Time Tracker</p>
      <p className="my-6 flex items-baseline justify-center text-5xl font-bold tracking-tight tabular-nums">
        <span>{hh}:{mm}:{ss}</span>
        <span className="ml-1 text-2xl font-semibold opacity-70">.{cs}</span>
      </p>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="grid h-12 w-12 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground transition hover:bg-primary-foreground/25"
          aria-label={running ? "Pause" : "Start"}
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={reset}
          className="grid h-12 w-12 place-items-center rounded-full bg-destructive text-destructive-foreground transition hover:opacity-90"
          aria-label="Reset"
        >
          <Square className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={openSave}
          disabled={ms <= 0}
          className="grid h-12 w-12 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground transition hover:bg-primary-foreground/25 disabled:opacity-40"
          aria-label="Save time to a member"
          title="Save time to a member"
        >
          <Save className="h-5 w-5" />
        </button>
      </div>

      {entries.length > 0 && (
        <div className="mt-5 space-y-1.5 border-t border-primary-foreground/15 pt-4">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">Recent</p>
          {entries.slice(0, 3).map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{e.memberName}</span>
              <span className="tabular-nums opacity-90">{formatDuration(e.ms)}</span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add time to a member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-foreground">
            <div className="rounded-2xl bg-muted p-3 text-center text-2xl font-bold tabular-nums">
              {formatDuration(ms)}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Member</label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Select a member" /></SelectTrigger>
                <SelectContent>
                  {(members || []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 1:1 session" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={saveEntry}><Save className="mr-2 h-4 w-4" /> Save time</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MemberHome({ data, profile }: { data: any; profile: any }) {
  const { hideAll } = usePrivacy();
  const stat = (value: number) => (hideAll ? <SensitiveValue>{value}</SensitiveValue> : value);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back{profile ? `, ${profile.display_name.split(" ")[0]}` : ""}</p>
        <h1 className="mt-1 text-3xl font-bold">Your home</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Upcoming sessions</p><p className="mt-2 text-3xl font-bold">{stat(data?.slots.length ?? 0)}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Announcements</p><p className="mt-2 text-3xl font-bold">{stat(data?.ann.length ?? 0)}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Members in club</p><p className="mt-2 text-3xl font-bold">{stat(data?.members.length ?? 0)}</p></Card>
      </div>
      <Card className="p-6">
        <p className="text-sm font-medium">Upcoming sessions</p>
        <div className="mt-4 divide-y divide-border">
          {(data?.slots.length ?? 0) === 0 && <p className="py-4 text-sm text-muted-foreground">No upcoming sessions yet.</p>}
          {data?.slots.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(s.starts_at), "EEE MMM d, h:mm a")} • {s.location}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
