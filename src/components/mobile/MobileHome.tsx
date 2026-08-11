// Mobile home screen.
//
// Reference implementation of the mobile layout: a week strip, the next
// session, money widgets, a stopwatch, a courses rail, everything happening on
// the selected day, and the trainer list. Other mobile screens should follow
// its structure and reuse the primitives in ./primitives.
//
// Everything below is driven by real club data. Where the source layout showed
// invented figures (a 5.0 star rating), this shows something the club actually
// knows — how many sessions that trainer is running this week.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, isSameDay, isToday, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { CalendarDays, Clock, CreditCard, Megaphone, Users, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAvatar } from "@/lib/user-settings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SensitiveValue } from "@/components/SensitiveValue";
import { DayStrip } from "@/components/mobile/DayStrip";
import { StopwatchCard } from "@/components/mobile/StopwatchCard";
import { ActionRow, Chip, EmptyLine, Rail, SectionHeader } from "@/components/mobile/primitives";
import { cn } from "@/lib/utils";

type Slot = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  capacity: number | null;
  trainer_id: string | null;
  group_id: string | null;
};

type Course = { id: string; name: string; color: string | null; price_cents: number | null };
type Person = { id: string; display_name: string; avatar_url: string | null };
type Announcement = { id: string; title: string; body: string | null; created_at: string };
type Payment = {
  id: string;
  amount_cents: number;
  status: string;
  period_month: string;
  member_id: string;
};
type Lead = { id: string; name: string; trial_date: string | null; status: string };

/** One thing happening on a given day, whatever its source table. */
type DayEvent = {
  key: string;
  kind: "session" | "announcement" | "invoice" | "trial";
  at: Date;
  title: string;
  detail?: string;
};

const WEEK_STARTS_ON = 1;

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;

export function MobileHome() {
  const { club, isStaff, user } = useAuth();
  const [selected, setSelected] = useState<Date>(() => new Date());

  const weekStart = useMemo(
    () => startOfWeek(selected, { weekStartsOn: WEEK_STARTS_ON }),
    [selected],
  );
  const weekKey = weekStart.toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    enabled: !!club,
    queryKey: ["mobile-home", club?.id, weekKey],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 7);
      const sb = supabase as any;
      const [slotsRes, coursesRes, staffRes, memberRes, nextRes, annRes, payRes, leadRes] =
        await Promise.all([
          supabase
            .from("time_slots")
            .select("id, title, starts_at, ends_at, location, capacity, trainer_id, group_id")
            .eq("club_id", club!.id)
            .gte("starts_at", weekStart.toISOString())
            .lt("starts_at", weekEnd.toISOString())
            .order("starts_at"),
          supabase
            .from("course_groups")
            .select("id, name, color, price_cents")
            .eq("club_id", club!.id)
            .order("name"),
          supabase
            .from("memberships")
            .select("user_id, role")
            .eq("club_id", club!.id)
            .in("role", ["club_owner", "trainer"]),
          supabase.from("memberships").select("group_id, role").eq("club_id", club!.id),
          // The next session may fall outside the visible week, so it needs its
          // own query rather than being read off the week above.
          supabase
            .from("time_slots")
            .select("id, title, starts_at, ends_at, location, capacity, trainer_id, group_id")
            .eq("club_id", club!.id)
            .gte("starts_at", new Date().toISOString())
            .order("starts_at")
            .limit(1),
          supabase
            .from("announcements")
            .select("id, title, body, created_at")
            .eq("club_id", club!.id)
            .gte("created_at", weekStart.toISOString())
            .lt("created_at", weekEnd.toISOString())
            .order("created_at", { ascending: false }),
          // RLS scopes this for us: staff see the whole club, a member sees
          // only their own invoices. Same query, different rows.
          supabase
            .from("payments")
            .select("id, amount_cents, status, period_month, member_id")
            .eq("club_id", club!.id)
            .gte("period_month", format(startOfYear(new Date()), "yyyy-MM-dd")),
          // Leads are staff-only at the policy level; members get an empty set.
          sb
            .from("leads")
            .select("id, name, trial_date, status")
            .eq("club_id", club!.id)
            .not("trial_date", "is", null),
        ]);

      const staffIds = (staffRes.data || []).map((m) => m.user_id);
      const profilesRes = staffIds.length
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", staffIds)
        : { data: [] as Person[] };

      return {
        slots: (slotsRes.data || []) as Slot[],
        courses: (coursesRes.data || []) as Course[],
        trainers: (profilesRes.data || []) as Person[],
        memberships: memberRes.data || [],
        next: ((nextRes.data || [])[0] as Slot | undefined) ?? null,
        announcements: (annRes.data || []) as Announcement[],
        payments: (payRes.data || []) as Payment[],
        leads: ((leadRes?.data || []) as Lead[]) ?? [],
      };
    },
  });

  // Memoised: a fresh [] on every render would invalidate every useMemo below.
  const slots = useMemo(() => data?.slots ?? [], [data?.slots]);

  // Everything happening in the visible week, normalised to one shape so the
  // day view and the strip's dots can both read from a single list.
  const weekEvents = useMemo<DayEvent[]>(() => {
    const out: DayEvent[] = [];
    for (const s of slots) {
      out.push({
        key: `s-${s.id}`,
        kind: "session",
        at: new Date(s.starts_at),
        title: s.title,
        detail: s.location ?? undefined,
      });
    }
    for (const a of data?.announcements ?? []) {
      out.push({
        key: `a-${a.id}`,
        kind: "announcement",
        at: new Date(a.created_at),
        title: a.title,
        detail: a.body ?? undefined,
      });
    }
    for (const p of data?.payments ?? []) {
      // period_month is a DATE — the period an invoice covers, so it lands on
      // the day that period starts.
      out.push({
        key: `p-${p.id}`,
        kind: "invoice",
        at: new Date(p.period_month),
        title: `${money(p.amount_cents)} invoice`,
        detail: p.status,
      });
    }
    for (const l of data?.leads ?? []) {
      if (!l.trial_date) continue;
      out.push({
        key: `l-${l.id}`,
        kind: "trial",
        at: new Date(l.trial_date),
        title: `Trial — ${l.name}`,
        detail: l.status,
      });
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [slots, data?.announcements, data?.payments, data?.leads]);

  const dayEvents = useMemo(
    () => weekEvents.filter((e) => isSameDay(e.at, selected)),
    [weekEvents, selected],
  );
  const markedDates = useMemo(() => weekEvents.map((e) => e.at), [weekEvents]);
  const daySlots = useMemo(
    () => slots.filter((s) => isSameDay(new Date(s.starts_at), selected)),
    [slots, selected],
  );

  const membersPerGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of data?.memberships ?? []) {
      if (m.role !== "student" || !m.group_id) continue;
      counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
    }
    return counts;
  }, [data?.memberships]);

  // Money. Staff see the club's position; a member sees their own, because RLS
  // already limited the rows to theirs.
  const monthKey = format(startOfMonth(new Date()), "yyyy-MM");
  const payments = data?.payments ?? [];
  const scoped = isStaff ? payments : payments.filter((p) => p.member_id === user?.id);
  const collectedThisMonth = scoped
    .filter((p) => p.status === "paid" && String(p.period_month).slice(0, 7) === monthKey)
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const outstanding = scoped.filter((p) => p.status !== "paid");
  const outstandingTotal = outstanding.reduce((sum, p) => sum + p.amount_cents, 0);

  return (
    <div className="space-y-7 pb-2">
      {/* Selected day */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {isToday(selected) ? "Today" : format(selected, "EEEE")}{" "}
            <span className="text-muted-foreground">{format(selected, "d MMM")}</span>
          </h2>
          <Link
            to="/app/schedule"
            aria-label="Open schedule"
            className="grid h-9 w-9 place-items-center rounded-full bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <CalendarDays className="h-4 w-4" />
          </Link>
        </div>
        <DayStrip
          selected={selected}
          onSelect={setSelected}
          markedDates={markedDates}
          weekStartsOn={WEEK_STARTS_ON}
        />
      </section>

      {/* Next session */}
      <section>
        {isLoading ? (
          <Skeleton className="h-[60px] w-full rounded-[--radius]" />
        ) : data?.next ? (
          <ActionRow to="/app/schedule" primary>
            <p className="text-sm font-semibold">
              {format(new Date(data.next.starts_at), "d MMM")}
              <span className="px-1.5 opacity-50">·</span>
              {format(new Date(data.next.starts_at), "HH:mm")}
            </p>
            <p className="truncate text-xs opacity-70">
              {data.next.title}
              {data.next.location ? ` — ${data.next.location}` : ""}
            </p>
          </ActionRow>
        ) : (
          <EmptyLine>No upcoming sessions scheduled.</EmptyLine>
        )}
      </section>

      {/* Money */}
      <section>
        <SectionHeader
          title={isStaff ? "Revenue" : "Billing"}
          to={isStaff ? "/app/revenue" : "/app/billing"}
        />
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-[--radius]" />
            <Skeleton className="h-24 rounded-[--radius]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label={isStaff ? "Collected this month" : "Paid this month"}
              value={money(collectedThisMonth)}
              sensitive
            />
            <StatTile
              label="Outstanding"
              value={money(outstandingTotal)}
              sub={`${outstanding.length} ${outstanding.length === 1 ? "invoice" : "invoices"}`}
              tone={outstandingTotal > 0 ? "warn" : undefined}
              sensitive
            />
          </div>
        )}
      </section>

      {/* Stopwatch — a coaching tool, so staff only. */}
      {isStaff && (
        <section>
          <SectionHeader title="Time tracker" />
          <StopwatchCard />
        </section>
      )}

      {/* Courses */}
      <section>
        <SectionHeader title="Courses" to="/app/courses" />
        {isLoading ? (
          <Rail>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-36 shrink-0 rounded-[--radius]" />
            ))}
          </Rail>
        ) : (data?.courses.length ?? 0) === 0 ? (
          <EmptyLine>No courses yet.</EmptyLine>
        ) : (
          <Rail>
            {data!.courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                memberCount={membersPerGroup.get(course.id) ?? 0}
              />
            ))}
          </Rail>
        )}
      </section>

      {/* Everything on the selected day */}
      <section>
        <SectionHeader
          title={isToday(selected) ? "Today" : format(selected, "EEEE d MMM")}
          to="/app/schedule"
        />
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-[--radius]" />
        ) : dayEvents.length === 0 ? (
          <EmptyLine>Nothing on {format(selected, "EEEE d MMM")}.</EmptyLine>
        ) : (
          <div className="space-y-2">
            {dayEvents.map((event) => (
              <EventRow key={event.key} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* Trainers */}
      <section>
        <SectionHeader title="Trainers" to={isStaff ? "/app/members" : undefined} />
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-[--radius]" />
        ) : (data?.trainers.length ?? 0) === 0 ? (
          <EmptyLine>No trainers in this club yet.</EmptyLine>
        ) : (
          <div className="space-y-2">
            {data!.trainers.map((trainer) => (
              <TrainerCard
                key={trainer.id}
                trainer={trainer}
                daySlots={daySlots.filter((s) => s.trainer_id === trainer.id)}
                weekCount={slots.filter((s) => s.trainer_id === trainer.id).length}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  tone,
  sensitive,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
  sensitive?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between rounded-[--radius] bg-card p-4 shadow-sm">
      <p className="text-xs leading-tight text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-3 font-display text-2xl font-semibold",
          tone === "warn" && "text-destructive",
        )}
      >
        {sensitive ? <SensitiveValue mask="$ ••••">{value}</SensitiveValue> : value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const EVENT_STYLES: Record<
  DayEvent["kind"],
  { icon: typeof Clock; label: string; to: string }
> = {
  session: { icon: Clock, label: "Session", to: "/app/schedule" },
  announcement: { icon: Megaphone, label: "Announcement", to: "/app/announcements" },
  invoice: { icon: CreditCard, label: "Invoice", to: "/app/billing" },
  trial: { icon: UserPlus, label: "Trial", to: "/app/leads" },
};

function EventRow({ event }: { event: DayEvent }) {
  const style = EVENT_STYLES[event.kind];
  const Icon = style.icon;
  return (
    <Link
      to={style.to}
      className="flex items-center gap-3 rounded-[--radius] bg-card p-3 shadow-sm transition-colors hover:bg-secondary"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary">
        {event.kind === "session" ? (
          <span className="text-xs font-semibold tabular-nums">{format(event.at, "HH:mm")}</span>
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{event.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
            {style.label}
          </span>
          {event.detail && <span className="truncate">{event.detail}</span>}
        </p>
      </div>
    </Link>
  );
}

function CourseCard({ course, memberCount }: { course: Course; memberCount: number }) {
  // Courses carry their own colour in the database. Use it as a soft wash so
  // the rail stays recognisable per course without importing a new palette.
  const tint = course.color || undefined;
  return (
    <Link
      to="/app/courses"
      className="relative flex h-28 w-36 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[--radius] bg-card p-3 shadow-sm transition-transform active:scale-[0.98]"
    >
      {tint && (
        <span
          aria-hidden
          className="absolute inset-0 opacity-15"
          style={{ background: `linear-gradient(140deg, ${tint} 0%, transparent 70%)` }}
        />
      )}
      <span
        aria-hidden
        className="relative h-7 w-7 rounded-full"
        style={{ background: tint || "var(--primary)", opacity: tint ? 0.9 : 0.15 }}
      />
      <div className="relative">
        <p className="truncate text-sm font-semibold leading-tight">{course.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" />
          {memberCount} {memberCount === 1 ? "athlete" : "athletes"}
        </p>
      </div>
    </Link>
  );
}

function TrainerCard({
  trainer,
  daySlots,
  weekCount,
}: {
  trainer: Person;
  daySlots: Slot[];
  weekCount: number;
}) {
  const avatar = useAvatar(trainer.id, trainer.avatar_url);
  const initials = trainer.display_name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-[--radius] bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11 shrink-0">
          {avatar && <AvatarImage src={avatar} alt="" />}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{trainer.display_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {weekCount === 0
              ? "No sessions this week"
              : `${weekCount} ${weekCount === 1 ? "session" : "sessions"} this week`}
          </p>
        </div>
      </div>
      <div className={cn("mt-3 flex gap-2 overflow-x-auto", "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
        {daySlots.length === 0 ? (
          <span className="text-xs text-muted-foreground">Not coaching on this day.</span>
        ) : (
          daySlots.map((slot) => (
            <Chip key={slot.id} title={slot.title}>
              {format(new Date(slot.starts_at), "HH:mm")}
            </Chip>
          ))
        )}
      </div>
    </div>
  );
}
