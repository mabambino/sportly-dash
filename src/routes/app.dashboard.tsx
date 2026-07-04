import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { SensitiveValue } from "@/components/SensitiveValue";
import {
  ArrowUpRight, Users, DollarSign, TrendingUp,
  UserPlus, Upload, Settings, Bell, CalendarDays, Play, Pause, Square,
} from "lucide-react";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { format, subDays, endOfDay, startOfMonth } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Syncletics" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { club, isStaff, profile } = useAuth();

  const { data, isLoading, error } = useQuery({
    enabled: !!club,
    queryKey: ["dashboard", club?.id],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const [members, slots, monthPayments, attTotal, attPresent, ann] = await Promise.all([
        supabase.from("memberships").select("role, joined_at").eq("club_id", club!.id),
        supabase.from("time_slots").select("*").eq("club_id", club!.id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
        supabase.from("payments").select("amount_cents, status").eq("club_id", club!.id).gte("period_month", monthStart),
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
  const paidThisMonth = (data?.monthPayments || []).filter((p) => p.status === "paid");
  const revenueThisMonth = paidThisMonth.reduce((s, p) => s + p.amount_cents, 0) / 100;

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

  if (error) {
    return <Card className="p-8 text-center text-sm text-destructive">Could not load the dashboard: {(error as Error).message}</Card>;
  }

  if (!isStaff) return <MemberHome data={data} profile={profile} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
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
          <Button asChild variant="outline" size="icon" className="rounded-full">
            <Link to="/app/settings"><Settings className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      {isStaff && !isLoading && students.length === 0 && (
        <div className="flex justify-end"><DemoSeedButton /></div>
      )}

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6"><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-10 w-20" /><Skeleton className="mt-4 h-3 w-24" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Members"
            value={members.length}
            sub={`${students.length} students enrolled`}
            to="/app/members"
            filled
          />
          <StatCard
            label="Attendance Rate"
            value={`${attRate}%`}
            sub={`Across ${data?.attTotal ?? 0} records`}
            subIcon={CalendarDays}
            to="/app/attendance"
          />
          <StatCard
            label="Upcoming Sessions"
            value={data?.slots.length ?? 0}
            sub="Next 7 days"
            subIcon={TrendingUp}
            to="/app/schedule"
          />
          <StatCard
            label="Monthly Revenue"
            value={`$${revenueThisMonth.toFixed(0)}`}
            sub={`$ ${paidThisMonth.length} paid`}
            subIcon={DollarSign}
            to="/app/revenue"
            sensitive
          />
        </div>
      )}

      {/* Analytics + Reminders */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">Club Analytics</p>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Last 7 days</span>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="analytics-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="day" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="currentColor" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Area dataKey="members" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#analytics-fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <p className="text-lg font-semibold">Reminders</p>
          </div>
          <div className="mt-6 space-y-3">
            {(data?.slots.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming sessions scheduled.</p>
            ) : (
              data!.slots.slice(0, 4).map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(s.starts_at), "EEE MMM d, h:mm a")}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Attendance progress + Time tracker + Announcements */}
      <div className="grid gap-6 lg:grid-cols-3">
        <AttendanceProgressCard present={data?.attPresent ?? 0} total={data?.attTotal ?? 0} rate={attRate} />
        <TimeTrackerCard />
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">Announcements</p>
            <Link to="/app/announcements" className="text-xs font-medium text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          <div className="mt-4 space-y-4">
            {(data?.ann.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            ) : (
              data!.ann.map((a) => (
                <div key={a.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
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
  return (
    <Card
      className={
        "relative overflow-hidden p-6 " +
        (filled ? "border-transparent bg-primary text-primary-foreground" : "")
      }
    >
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
        {sensitive ? <SensitiveValue mask="$ ••••">{value}</SensitiveValue> : value}
      </p>
      <div className={"mt-4 flex items-center gap-1.5 text-xs " + (filled ? "text-primary-foreground/70" : "text-muted-foreground")}>
        {SubIcon && <SubIcon className="h-3.5 w-3.5" />}
        <span>{sub}</span>
      </div>
    </Card>
  );
}

function AttendanceProgressCard({ present, total, rate }: { present: number; total: number; rate: number }) {
  const chartData = [{ name: "rate", value: rate, fill: "var(--color-primary)" }];
  return (
    <Card className="p-6">
      <p className="text-lg font-semibold">Attendance Progress</p>
      <div className="mt-4 flex items-center justify-center">
        <div className="relative h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="75%"
              outerRadius="100%"
              data={chartData}
              startAngle={180}
              endAngle={0}
              cy="90%"
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "var(--color-muted)" }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
            <p className="text-3xl font-bold">{rate}%</p>
            <p className="text-xs text-muted-foreground">Present rate</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Present ({present})</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" />Total ({total})</span>
      </div>
    </Card>
  );
}

function TimeTrackerCard() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = window.setInterval(() => {
      setMs(baseRef.current + (Date.now() - (startRef.current ?? Date.now())));
    }, 50);
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

  const total = ms;
  const hh = String(Math.floor(total / 3600000)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600000) / 60000)).padStart(2, "0");
  const ss = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
  const cs = String(Math.floor((total % 1000) / 10)).padStart(2, "0");


  return (
    <Card className="flex flex-col justify-between border-transparent bg-primary p-6 text-primary-foreground">
      <p className="text-lg font-semibold">Time Tracker</p>
      <p className="my-6 text-center font-mono text-5xl font-bold tracking-tight">{hh}:{mm}:{ss}</p>
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
      </div>
    </Card>
  );
}

function MemberHome({ data, profile }: { data: any; profile: any }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back{profile ? `, ${profile.display_name.split(" ")[0]}` : ""}</p>
        <h1 className="mt-1 text-3xl font-bold">Your home</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Upcoming sessions</p><p className="mt-2 text-3xl font-bold">{data?.slots.length ?? 0}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Announcements</p><p className="mt-2 text-3xl font-bold">{data?.ann.length ?? 0}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Members in club</p><p className="mt-2 text-3xl font-bold">{data?.members.length ?? 0}</p></Card>
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
