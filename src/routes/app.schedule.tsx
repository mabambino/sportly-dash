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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, MapPin, Clock, Users as UsersIcon, Check, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  format, addDays, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
} from "date-fns";
import { toast } from "sonner";


export const Route = createFileRoute("/app/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Syncletics" }] }),
  component: SchedulePage,
});

function SchedulePage() {
  const { club, isStaff, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>("all");

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

  const toggleRsvp = async (slotId: string, capacity: number) => {
    if (!user) return;
    const existing = rsvps?.find((r) => r.slot_id === slotId && r.user_id === user.id);
    if (existing) {
      await supabase.from("rsvps").delete().eq("id", existing.id);
      toast.success("RSVP removed");
    } else {
      // Enforce capacity before inserting.
      const going = rsvps?.filter((r) => r.slot_id === slotId).length ?? 0;
      if (going >= capacity) {
        toast.error("This session is full");
        return;
      }
      await supabase.from("rsvps").insert({ slot_id: slotId, user_id: user.id, status: "going" });
      toast.success("You're going!");
    }
    qc.invalidateQueries({ queryKey: ["rsvps"] });
  };

  const visibleSlots = filterGroup === "all"
    ? slots
    : filterGroup === "none"
      ? slots?.filter((s) => !s.group_id)
      : slots?.filter((s) => s.group_id === filterGroup);

  // Export upcoming sessions as an iCalendar file that can be imported
  // into Google Calendar, Apple Calendar, Outlook, etc.
  const exportIcs = () => {
    const upcoming = (visibleSlots || []).filter((s) => new Date(s.starts_at) >= new Date());
    if (!upcoming.length) { toast.error("No upcoming sessions to export"); return; }
    const dt = (iso: string) => format(new Date(iso), "yyyyMMdd'T'HHmmss");
    const esc = (t: string) => t.replace(/([,;])/g, "\\$1");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Syncletics//Schedule//EN",
      ...upcoming.flatMap((s) => [
        "BEGIN:VEVENT",
        `UID:${s.id}@syncletics`,
        `DTSTART:${dt(s.starts_at)}`,
        `DTEND:${dt(s.ends_at)}`,
        `SUMMARY:${esc(s.title)}`,
        s.location ? `LOCATION:${esc(s.location)}` : "",
        s.description ? `DESCRIPTION:${esc(s.description)}` : "",
        "END:VEVENT",
      ]).filter(Boolean),
      "END:VCALENDAR",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${club?.name?.replace(/\s+/g, "-").toLowerCase() || "club"}-schedule.ics`;
    a.click();
    toast.success(`Exported ${upcoming.length} sessions`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">{visibleSlots?.length ?? 0} sessions</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {groups && groups.length > 0 && (
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="w-44">
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
          <Button variant="outline" onClick={exportIcs}>
            <Download className="mr-2 h-4 w-4" /> Export calendar
          </Button>
          {isStaff && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="bg-gradient-hero"><Plus className="mr-2 h-4 w-4" /> New session</Button></DialogTrigger>
              <NewSlotDialog groups={groups || []} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["slots"] }); }} />
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <div className="grid gap-4">
            {visibleSlots?.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No sessions scheduled yet.</Card>}
            {visibleSlots?.map((s) => {
              const count = rsvps?.filter((r) => r.slot_id === s.id).length ?? 0;
              const mine = rsvps?.find((r) => r.slot_id === s.id && r.user_id === user?.id);
              const past = new Date(s.starts_at) < new Date();
              const full = count >= s.capacity;
              const group = groups?.find((g: any) => g.id === s.group_id);
              const durationMin = s.ends_at
                ? Math.round((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000)
                : null;
              return (
                <Card key={s.id} className="overflow-hidden">
                  {group && <div className="h-1 w-full" style={{ backgroundColor: group.color }} />}
                  <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{s.title}</h3>
                        {past && <Badge variant="secondary">Past</Badge>}
                        {!past && full && <Badge variant="destructive">Full</Badge>}
                        {group && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: group.color }}
                          >
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
                      <Button
                        onClick={() => toggleRsvp(s.id, s.capacity)}
                        variant={mine ? "default" : "outline"}
                        disabled={!mine && full}
                      >
                        {mine ? <><Check className="mr-2 h-4 w-4" /> Going</> : full ? "Full" : "RSVP"}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="month" className="mt-4">
          <MonthView slots={visibleSlots || []} groups={groups || []} />
        </TabsContent>
        <TabsContent value="week" className="mt-4">
          <WeekView slots={visibleSlots || []} groups={groups || []} />
        </TabsContent>
        <TabsContent value="day" className="mt-4">
          <DayView slots={visibleSlots || []} groups={groups || []} />
        </TabsContent>
      </Tabs>
    </div>
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

  // Auto-fill duration from selected group
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

type Slot = { id: string; title: string; starts_at: string; ends_at: string; group_id: string | null; location: string | null };
type Group = { id: string; name: string; color: string };

function ViewHeader({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold">{label}</h2>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
        <Button variant="outline" size="icon" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function MonthView({ slots, groups }: { slots: Slot[]; groups: Group[] }) {
  const [cursor, setCursor] = useState(new Date());
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);
  const colorFor = (gid: string | null) => groups.find((g) => g.id === gid)?.color || "hsl(var(--primary))";

  return (
    <Card className="p-4">
      <ViewHeader
        label={format(cursor, "MMMM yyyy")}
        onPrev={() => setCursor(addMonths(cursor, -1))}
        onNext={() => setCursor(addMonths(cursor, 1))}
        onToday={() => setCursor(new Date())}
      />
      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden bg-border text-xs">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
          <div key={d} className="bg-muted/50 p-2 text-center font-medium text-muted-foreground">{d}</div>
        ))}
        {days.map((d) => {
          const daySlots = slots.filter((s) => isSameDay(new Date(s.starts_at), d));
          const otherMonth = !isSameMonth(d, cursor);
          return (
            <div key={d.toISOString()} className={`min-h-24 bg-background p-1.5 ${otherMonth ? "opacity-40" : ""}`}>
              <div className={`text-[11px] font-semibold ${isToday(d) ? "text-primary" : "text-muted-foreground"}`}>
                {format(d, "d")}
              </div>
              <div className="mt-1 space-y-0.5">
                {daySlots.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: colorFor(s.group_id) }}
                    title={s.title}
                  >
                    {format(new Date(s.starts_at), "HH:mm")} {s.title}
                  </div>
                ))}
                {daySlots.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{daySlots.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekView({ slots, groups }: { slots: Slot[]; groups: Group[] }) {
  const [cursor, setCursor] = useState(new Date());
  const start = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end: addDays(start, 6) });
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7..20
  const colorFor = (gid: string | null) => groups.find((g) => g.id === gid)?.color || "hsl(var(--primary))";

  return (
    <Card className="p-4">
      <ViewHeader
        label={`${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")}`}
        onPrev={() => setCursor(addDays(cursor, -7))}
        onNext={() => setCursor(addDays(cursor, 7))}
        onToday={() => setCursor(new Date())}
      />
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] text-xs">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className={`p-2 text-center font-medium ${isToday(d) ? "text-primary" : "text-muted-foreground"}`}>
            {format(d, "EEE d")}
          </div>
        ))}
        {hours.map((h) => (
          <>
            <div key={`h-${h}`} className="border-t border-border pr-2 pt-1 text-right text-[10px] text-muted-foreground">{h}:00</div>
            {days.map((d) => {
              const cellStart = new Date(d); cellStart.setHours(h, 0, 0, 0);
              const cellEnd = new Date(d); cellEnd.setHours(h + 1, 0, 0, 0);
              const cellSlots = slots.filter((s) => {
                const t = new Date(s.starts_at);
                return t >= cellStart && t < cellEnd;
              });
              return (
                <div key={`${d.toISOString()}-${h}`} className="min-h-12 border-t border-l border-border p-0.5">
                  {cellSlots.map((s) => (
                    <div
                      key={s.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: colorFor(s.group_id) }}
                      title={s.title}
                    >
                      {s.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </Card>
  );
}

function DayView({ slots, groups }: { slots: Slot[]; groups: Group[] }) {
  const [cursor, setCursor] = useState(new Date());
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6..21
  const daySlots = slots
    .filter((s) => isSameDay(new Date(s.starts_at), cursor))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const colorFor = (gid: string | null) => groups.find((g) => g.id === gid)?.color || "hsl(var(--primary))";

  return (
    <Card className="p-4">
      <ViewHeader
        label={format(cursor, "EEEE, MMMM d, yyyy")}
        onPrev={() => setCursor(addDays(cursor, -1))}
        onNext={() => setCursor(addDays(cursor, 1))}
        onToday={() => setCursor(new Date())}
      />
      {daySlots.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No sessions on this day.</p>
      ) : (
        <div className="divide-y divide-border">
          {hours.map((h) => {
            const rowSlots = daySlots.filter((s) => new Date(s.starts_at).getHours() === h);
            return (
              <div key={h} className="grid grid-cols-[4rem_1fr] gap-3 py-2">
                <div className="text-xs text-muted-foreground">{String(h).padStart(2, "0")}:00</div>
                <div className="space-y-1">
                  {rowSlots.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-md px-3 py-2 text-sm font-medium text-white"
                      style={{ backgroundColor: colorFor(s.group_id) }}
                    >
                      {format(new Date(s.starts_at), "HH:mm")} · {s.title}
                      {s.location && <span className="ml-2 text-xs opacity-80">{s.location}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

