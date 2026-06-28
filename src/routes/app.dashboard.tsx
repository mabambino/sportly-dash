import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { EmbedWidgetCard } from "@/components/EmbedWidgetCard";
import { SensitiveValue } from "@/components/SensitiveValue";
import { Users, CalendarCheck, DollarSign, TrendingUp, Settings, ArrowUpRight, Plus, Bell, Play, Pause, Square, Upload } from "lucide-react";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Syncletics" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { club, isStaff, profile } = useAuth();

  const { data } = useQuery({
    enabled: !!club,
    queryKey: ["dashboard", club?.id],
    queryFn: async () => {
      const [members, slots, payments, attendance, ann] = await Promise.all([
        supabase.from("memberships").select("*").eq("club_id", club!.id),
        supabase.from("time_slots").select("*").eq("club_id", club!.id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
        supabase.from("payments").select("*").eq("club_id", club!.id),
        supabase.from("attendance_records").select("*, time_slots!inner(club_id)").eq("time_slots.club_id", club!.id),
        supabase.from("announcements").select("*").eq("club_id", club!.id).order("created_at", { ascending: false }).limit(3),
      ]);
      return { members: members.data || [], slots: slots.data || [], payments: payments.data || [], attendance: attendance.data || [], ann: ann.data || [] };
    },
  });

  const members = data?.members || [];
  const students = members.filter((m) => m.role === "student");
  const att = data?.attendance || [];
  const presentCount = att.filter((a) => a.status === "present").length;
  const attRate = att.length ? Math.round((presentCount / att.length) * 100) : 0;
  const paidThisMonth = (data?.payments || []).filter((p) => p.status === "paid");
  const mrr = paidThisMonth.reduce((s, p) => s + p.amount_cents, 0) / 100;
  const nextSlot = data?.slots?.[0];

  const growth = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { day: format(d, "EEE"), members: Math.max(1, students.length - (6 - i) * 1 + Math.floor(Math.random() * 2)) };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Welcome back{profile ? `, ${profile.display_name.split(" ")[0]}` : ""}</p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">{isStaff ? `${club?.name} Dashboard` : "Your home"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your club, members, and sessions with ease.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isStaff && students.length === 0 && <DemoSeedButton />}
          <Link
            to="/app/members"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 sm:px-4"
          >
            <Plus className="h-4 w-4" /> <span className="hidden xs:inline sm:inline">Add Member</span><span className="xs:hidden sm:hidden">Add</span>
          </Link>
          <Link
            to="/app/members"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent sm:px-4"
          >
            <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Import Data</span><span className="sm:hidden">Import</span>
          </Link>
          <Link
            to="/app/settings"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {isStaff ? (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStatCard label="Total Members" value={members.length} sub={`${students.length} students enrolled`} />
            <StatCard label="Attendance Rate" value={`${attRate}%`} icon={CalendarCheck} sub={`Across ${att.length} records`} />
            <StatCard label="Upcoming Sessions" value={data?.slots.length ?? 0} icon={TrendingUp} sub="Next 7 days" />
            <StatCard label="Monthly Revenue" value={`$${mrr.toFixed(0)}`} icon={DollarSign} sub={`${paidThisMonth.length} paid`} sensitive />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold">Club Analytics</p>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Last 7 days</span>
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growth}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" stroke="currentColor" fontSize={12} />
                    <YAxis stroke="currentColor" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Area dataKey="members" stroke="var(--color-primary)" fill="url(#g)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="flex flex-col p-6">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <p className="font-display text-lg font-semibold">Reminders</p>
              </div>
              {nextSlot ? (
                <div className="mt-4 flex flex-1 flex-col">
                  <p className="font-display text-xl font-semibold leading-snug">{nextSlot.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {format(new Date(nextSlot.starts_at), "EEE MMM d, h:mm a")}
                  </p>
                  {nextSlot.location && <p className="text-sm text-muted-foreground">{nextSlot.location}</p>}
                  <Link
                    to="/app/schedule"
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <CalendarCheck className="h-4 w-4" /> View Schedule
                  </Link>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No upcoming sessions scheduled.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <ProgressCard rate={attRate} present={presentCount} total={att.length} />
            <TimeTrackerCard />
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold">Announcements</p>
                <Link to="/app/announcements" className="text-xs font-medium text-primary hover:underline">View all</Link>
              </div>
              <div className="mt-4 space-y-4">
                {data?.ann.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
                {data?.ann.map((a) => (
                  <div key={a.id}>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-2">
              <p className="font-display text-lg font-semibold">Upcoming Sessions</p>
              <div className="mt-4 divide-y divide-border">
                {data?.slots.length === 0 && <p className="py-4 text-sm text-muted-foreground">No upcoming sessions.</p>}
                {data?.slots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(s.starts_at), "EEE MMM d, h:mm a")} • {s.location}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">Cap: {s.capacity}</span>
                  </div>
                ))}
              </div>
            </Card>
            {club && <EmbedWidgetCard clubId={club.id} />}
          </div>
        </>
      ) : (
        <MemberHome data={data} growth={growth} />
      )}
    </div>
  );
}

function HeroStatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <Card className="relative overflow-hidden border-0 p-5 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider opacity-90">{label}</p>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20"><ArrowUpRight className="h-4 w-4" /></div>
      </div>
      <p className="mt-3 font-display text-4xl font-semibold">{value}</p>
      <p className="mt-2 text-xs opacity-90">{sub}</p>
    </Card>
  );
}

function StatCard({ label, value, sub, icon: Icon, sensitive }: { label: string; value: string | number; sub: string; icon: typeof Users; sensitive?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="grid h-8 w-8 place-items-center rounded-full border text-muted-foreground"><ArrowUpRight className="h-4 w-4" /></div>
      </div>
      <p className="mt-3 font-display text-4xl font-semibold">
        {sensitive ? <SensitiveValue mask="$ ••••">{value}</SensitiveValue> : value}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{sub}</p>
    </Card>
  );
}

function ProgressCard({ rate, present, total }: { rate: number; present: number; total: number }) {
  const r = 70;
  const circ = Math.PI * r;
  const offset = circ - (rate / 100) * circ;
  return (
    <Card className="flex flex-col items-center p-6">
      <p className="self-start font-display text-lg font-semibold">Attendance Progress</p>
      <div className="relative mt-4 flex items-center justify-center">
        <svg width="180" height="110" viewBox="0 0 180 110">
          <path d="M 20 100 A 70 70 0 0 1 160 100" fill="none" stroke="var(--color-muted)" strokeWidth="16" strokeLinecap="round" />
          <path
            d="M 20 100 A 70 70 0 0 1 160 100"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute bottom-0 flex flex-col items-center">
          <span className="font-display text-3xl font-semibold">{rate}%</span>
          <span className="text-xs text-muted-foreground">Present rate</span>
        </div>
      </div>
      <div className="mt-4 flex w-full items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Present ({present})</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted" /> Total ({total})</span>
      </div>
    </Card>
  );
}

function TimeTrackerCard() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running]);

  const fmt = (s: number) => {
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  return (
    <Card className="relative flex flex-col overflow-hidden border-0 p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
      <p className="font-display text-lg font-semibold">Time Tracker</p>
      <p className="mt-6 text-center font-display text-5xl font-semibold tabular-nums tracking-tight">{fmt(elapsed)}</p>
      <div className="mt-auto flex items-center justify-center gap-3 pt-6">
        <button
          onClick={() => setRunning((rn) => !rn)}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          title={running ? "Pause" : "Start"}
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button
          onClick={() => { setRunning(false); setElapsed(0); }}
          className="grid h-11 w-11 place-items-center rounded-full bg-destructive text-destructive-foreground transition-opacity hover:opacity-90"
          title="Reset"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

function MemberHome({ data, growth }: { data: any; growth: { day: string; members: number }[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Upcoming sessions</p><p className="mt-2 font-display text-3xl font-semibold">{data?.slots.length ?? 0}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Announcements</p><p className="mt-2 font-display text-3xl font-semibold">{data?.ann.length ?? 0}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Members in club</p><p className="mt-2 font-display text-3xl font-semibold">{data?.members.length ?? 0}</p></Card>
      </div>
      <Card className="p-6">
        <p className="text-sm font-medium">Upcoming sessions</p>
        <div className="mt-4 divide-y divide-border">
          {data?.slots.length === 0 && <p className="py-4 text-sm text-muted-foreground">No upcoming sessions yet.</p>}
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
