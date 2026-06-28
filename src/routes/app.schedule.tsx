import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MapPin, Clock, Users as UsersIcon, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Syncletics" }] }),
  component: SchedulePage,
});

type ViewMode = "list" | "week7" | "week5" | "month";

function SchedulePage() {
  const { club, isStaff, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [view, setView] = useState<ViewMode>("week7");
  const [cursor, setCursor] = useState<Date>(new Date());

  const { data: slots } = useQuery({
    enabled: !!club,
    queryKey: ["slots", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("time_slots").select("*").eq("club_id", club!.id).order("starts_at");
      return data || [];
    },
  });

  const { data: rsvps } = useQuery({
    enabled: !!club,
    queryKey: ["rsvps", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("rsvps").select("*, time_slots!inner(club_id)").eq("time_slots.club_id", club!.id);
      return data || [];
    },
  });

  const { data: groups } = useQuery({
    enabled: !!club,
    queryKey: ["groups", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("course_groups").select("*").eq("club_id", club!.id).order("name");
      return data || [];
    },
  });

  const toggleRsvp = async (slotId: string) => {
    if (!user) return;
    const existing = rsvps?.find((r) => r.slot_id === slotId && r.user_id === user.id);
    if (existing) {
      await supabase.from("rsvps").delete().eq("id", existing.id);
      toast.success("RSVP removed");
    } else {
      await supabase.from("rsvps").insert({ slot_id: slotId, user_id: user.id, status: "going" });
      toast.success("You're going!");
    }
    qc.invalidateQueries({ queryKey: ["rsvps"] });
  };

  const visibleSlots = useMemo(() => {
    if (!slots) return [];
    if (filterGroup === "all") return slots;
    if (filterGroup === "none") return slots.filter((s) => !s.group_id);
    return slots.filter((s) => s.group_id === filterGroup);
  }, [slots, filterGroup]);

  // Range for current view
  const range = useMemo(() => {
    if (view === "week7") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return { start, days: 7, label: `${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")}` };
    }
    if (view === "week5") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return { start, days: 5, label: `${format(start, "MMM d")} – ${format(addDays(start, 4), "MMM d, yyyy")}` };
    }
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      return { start, days, label: format(cursor, "MMMM yyyy") };
    }
    return { start: new Date(), days: 0, label: "All upcoming" };
  }, [view, cursor]);

  const navigate = (dir: -1 | 1) => {
    if (view === "month") setCursor(dir > 0 ? addMonths(cursor, 1) : subMonths(cursor, 1));
    else setCursor(dir > 0 ? addWeeks(cursor, 1) : subWeeks(cursor, 1));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Schedule</h1>
          <p className="text-sm text-muted-foreground">{visibleSlots?.length ?? 0} sessions</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {groups && groups.length > 0 && (
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="w-36 sm:w-44">
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                <SelectItem value="none">No group</SelectItem>
                {groups.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: g.color }} />
                      {g.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isStaff && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="bg-gradient-hero"><Plus className="mr-1.5 h-4 w-4" /> <span className="hidden xs:inline">New session</span><span className="xs:hidden">New</span></Button></DialogTrigger>
              <NewSlotDialog groups={groups || []} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["slots"] }); }} />
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="-mx-1 max-w-full overflow-x-auto px-1">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="week7" className="text-xs sm:text-sm">Week</TabsTrigger>
              <TabsTrigger value="week5" className="text-xs sm:text-sm">Workweek</TabsTrigger>
              <TabsTrigger value="month" className="text-xs sm:text-sm">Month</TabsTrigger>
              <TabsTrigger value="list" className="text-xs sm:text-sm">List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {view !== "list" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
            <span className="ml-1 text-xs font-medium sm:ml-2 sm:text-sm">{range.label}</span>
          </div>
        )}
      </div>

      {view === "list" && (
        <ListView slots={visibleSlots} rsvps={rsvps} groups={groups} user={user} onToggle={toggleRsvp} />
      )}
      {(view === "week7" || view === "week5") && (
        <WeekView
          start={range.start}
          days={range.days}
          slots={visibleSlots}
          rsvps={rsvps}
          groups={groups}
          user={user}
          onToggle={toggleRsvp}
        />
      )}
      {view === "month" && (
        <MonthView
          start={range.start}
          days={range.days}
          cursor={cursor}
          slots={visibleSlots}
          groups={groups}
          onPickDay={(d: Date) => { setCursor(d); setView("week7"); }}
        />
      )}
    </div>
  );
}

function SlotCard({ s, rsvps, groups, user, onToggle }: any) {
  const count = rsvps?.filter((r: any) => r.slot_id === s.id).length ?? 0;
  const mine = rsvps?.find((r: any) => r.slot_id === s.id && r.user_id === user?.id);
  const past = new Date(s.starts_at) < new Date();
  const group = groups?.find((g: any) => g.id === s.group_id);
  const durationMin = s.ends_at ? Math.round((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000) : null;
  return (
    <Card className="overflow-hidden">
      {group && <div className="h-1 w-full" style={{ backgroundColor: group.color }} />}
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{s.title}</h3>
            {past && <Badge variant="secondary">Past</Badge>}
            {group && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: group.color }}>
                {group.name}
              </span>
            )}
          </div>
          {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {format(new Date(s.starts_at), "EEE MMM d, h:mm a")}
              {durationMin && <span className="text-xs">· {durationMin} min</span>}
            </span>
            {s.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {s.location}</span>}
            <span className="flex items-center gap-1.5"><UsersIcon className="h-4 w-4" /> {count}/{s.capacity}</span>
          </div>
        </div>
        {!past && (
          <Button onClick={() => onToggle(s.id)} variant={mine ? "default" : "outline"}>
            {mine ? <><Check className="mr-2 h-4 w-4" /> Going</> : "RSVP"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function ListView({ slots, rsvps, groups, user, onToggle }: any) {
  return (
    <div className="grid gap-4">
      {slots?.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No sessions scheduled yet.</Card>}
      {slots?.map((s: any) => <SlotCard key={s.id} s={s} rsvps={rsvps} groups={groups} user={user} onToggle={onToggle} />)}
    </div>
  );
}

function WeekView({ start, days, slots, rsvps, groups, user, onToggle }: any) {
  const dayList = Array.from({ length: days }, (_, i) => addDays(start, i));
  const slotsByDay = (d: Date) =>
    (slots || [])
      .filter((s: any) => isSameDay(new Date(s.starts_at), d))
      .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${days}, minmax(110px, 1fr))` }}>
      {dayList.map((d) => {
        const todays = slotsByDay(d);
        const isToday = isSameDay(d, new Date());
        return (
          <div key={d.toISOString()} className="min-w-0">
            <div className={`mb-2 rounded-md px-2 py-1.5 text-center ${isToday ? "bg-primary text-primary-foreground" : "bg-muted/40"}`}>
              <div className="text-[10px] uppercase tracking-wide">{format(d, "EEE")}</div>
              <div className="text-base font-semibold">{format(d, "d")}</div>
            </div>
            <div className="space-y-2">
              {todays.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">—</div>}
              {todays.map((s: any) => {
                const group = groups?.find((g: any) => g.id === s.group_id);
                const mine = rsvps?.find((r: any) => r.slot_id === s.id && r.user_id === user?.id);
                const past = new Date(s.starts_at) < new Date();
                const count = rsvps?.filter((r: any) => r.slot_id === s.id).length ?? 0;
                return (
                  <Card key={s.id} className="p-2.5 text-xs space-y-1 overflow-hidden">
                    {group && <div className="h-0.5 -mt-2.5 -mx-2.5 mb-1" style={{ backgroundColor: group.color }} />}
                    <div className="font-semibold truncate">{s.title}</div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" /> {format(new Date(s.starts_at), "h:mm a")}
                    </div>
                    {s.location && (
                      <div className="flex items-center gap-1 text-muted-foreground truncate">
                        <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{s.location}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <UsersIcon className="h-3 w-3" /> {count}/{s.capacity}
                      </span>
                      {!past && (
                        <Button size="sm" variant={mine ? "default" : "outline"} className="h-6 px-2 text-[10px]" onClick={() => onToggle(s.id)}>
                          {mine ? "Going" : "RSVP"}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}

function MonthView({ start, days, cursor, slots, groups, onPickDay }: any) {
  const dayList = Array.from({ length: days }, (_, i) => addDays(start, i));
  const weeks: Date[][] = [];
  for (let i = 0; i < dayList.length; i += 7) weeks.push(dayList.slice(i, i + 7));
  const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const slotsByDay = (d: Date) =>
    (slots || []).filter((s: any) => isSameDay(new Date(s.starts_at), d));

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium">
        {dayHeaders.map((h) => <div key={h} className="px-2 py-2 text-center">{h}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((d) => {
          const todays = slotsByDay(d);
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPickDay(d)}
              className={`min-h-[88px] border-b border-r p-1.5 text-left hover:bg-muted/30 transition ${!inMonth ? "bg-muted/10 text-muted-foreground" : ""}`}
            >
              <div className={`text-xs font-semibold mb-1 ${isToday ? "text-primary" : ""}`}>{format(d, "d")}</div>
              <div className="space-y-0.5">
                {todays.slice(0, 3).map((s: any) => {
                  const group = groups?.find((g: any) => g.id === s.group_id);
                  return (
                    <div
                      key={s.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                      style={{ backgroundColor: group?.color || "hsl(var(--primary))" }}
                    >
                      {format(new Date(s.starts_at), "HH:mm")} {s.title}
                    </div>
                  );
                })}
                {todays.length > 3 && <div className="text-[10px] text-muted-foreground">+{todays.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function NewSlotDialog({ groups, onDone }: { groups: any[]; onDone: () => void }) {
  const { club, user } = useAuth();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("17:00");
  const [duration, setDuration] = useState("90");
  const [location, setLocation] = useState("Main Field");
  const [capacity, setCapacity] = useState("20");
  const [groupId, setGroupId] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  const onGroupChange = (val: string) => {
    setGroupId(val);
    if (val !== "none") {
      const g = groups.find((g) => g.id === val);
      if (g) {
        setDuration(String(g.session_duration_minutes));
        if (g.schedule_time) setTime(g.schedule_time);
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club || !user) return;
    setBusy(true);
    const starts = new Date(`${date}T${time}`);
    const ends = new Date(starts.getTime() + parseInt(duration) * 60000);
    const { error } = await supabase.from("time_slots").insert({
      club_id: club.id, title,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      location, capacity: parseInt(capacity),
      trainer_id: user.id,
      group_id: groupId === "none" ? null : groupId,
    });
    if (error) toast.error(error.message);
    else { toast.success("Session created"); onDone(); }
    setBusy(false);
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New training session</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Friday Practice" /></div>

        {groups.length > 0 && (
          <div>
            <Label>Course group</Label>
            <Select value={groupId} onValueChange={onGroupChange}>
              <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: g.color }} />
                      {g.name} · ${(g.price_cents / 100).toFixed(0)}/mo · {g.session_duration_minutes} min
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Duration (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div><Label>Capacity</Label><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
        </div>
        <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Creating…" : "Create session"}</Button>
      </form>
    </DialogContent>
  );
}
