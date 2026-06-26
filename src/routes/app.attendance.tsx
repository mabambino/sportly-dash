import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Syncletics" }] }),
  component: AttendancePage,
});

function AttendancePage() {
  const { club, isStaff } = useAuth();
  const qc = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const { data: groups } = useQuery({ enabled: !!club, queryKey: ["groups", club?.id], queryFn: async () => { const { data } = await supabase.from("course_groups").select("*").eq("club_id", club!.id).order("name"); return data || []; } });
  const { data: slots } = useQuery({ enabled: !!club, queryKey: ["slots-att", club?.id], queryFn: async () => { const { data } = await supabase.from("time_slots").select("*, course_groups(name,color)").eq("club_id", club!.id).order("starts_at", { ascending: false }); return data || []; } });
  const visibleSlots = filterGroup === "all" ? slots : filterGroup === "none" ? slots?.filter((s: any) => !s.group_id) : slots?.filter((s: any) => s.group_id === filterGroup);
  const { data: rsvps } = useQuery({ enabled: !!selectedSlot, queryKey: ["rsvps-att", selectedSlot], queryFn: async () => { const { data } = await supabase.from("rsvps").select("*, profiles(display_name, id)").eq("slot_id", selectedSlot); return data || []; } });
  const { data: memberships } = useQuery({
    enabled: !!club && !!selectedSlot, queryKey: ["students-att", club?.id, selectedSlot, filterGroup],
    queryFn: async () => {
      const slot = slots?.find((s: any) => s.id === selectedSlot);
      let q = supabase.from("memberships").select("*, profiles(display_name, id)").eq("club_id", club!.id).eq("role", "student");
      if (slot?.group_id) q = q.eq("group_id", slot.group_id);
      else if (filterGroup !== "all" && filterGroup !== "none") q = q.eq("group_id", filterGroup);
      const { data } = await q; return data || [];
    },
  });
  const { data: records } = useQuery({ enabled: !!selectedSlot, queryKey: ["att", selectedSlot], queryFn: async () => { const { data } = await supabase.from("attendance_records").select("*").eq("slot_id", selectedSlot); return data || []; } });
  const mark = async (studentId: string, status: "present" | "absent") => {
    const existing = records?.find((r) => r.student_id === studentId);
    if (existing) await supabase.from("attendance_records").update({ status }).eq("id", existing.id);
    else await supabase.from("attendance_records").insert({ slot_id: selectedSlot, student_id: studentId, status });
    qc.invalidateQueries({ queryKey: ["att", selectedSlot] }); toast.success(`Marked ${status}`);
  };
  const markAllFromRsvp = async () => {
    if (!rsvps?.length) return;
    const inserts = rsvps.filter((r: any) => !records?.find((rec) => rec.student_id === r.user_id)).map((r: any) => ({ slot_id: selectedSlot, student_id: r.user_id, status: "present" as const }));
    if (inserts.length) { await supabase.from("attendance_records").insert(inserts); qc.invalidateQueries({ queryKey: ["att", selectedSlot] }); toast.success(`Auto-marked ${inserts.length} students present`); }
    else toast.info("All RSVP'd students already marked");
  };
  const sd = slots?.find((s: any) => s.id === selectedSlot);
  const presentCount = records?.filter((r) => r.status === "present").length ?? 0;
  const absentCount = records?.filter((r) => r.status === "absent").length ?? 0;
  const students = memberships?.map((m: any) => m.profiles).filter(Boolean) || [];
  if (!isStaff) return <Card className="p-8 text-center text-muted-foreground">Attendance is managed by trainers.</Card>;
  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-3xl font-semibold">Attendance</h1><p className="text-sm text-muted-foreground">Mark students present or absent for each session.</p></div>
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {groups && groups.length > 0 && (<div className="flex-1 min-w-40"><label className="text-sm font-medium">Filter by group</label>
            <Select value={filterGroup} onValueChange={(v) => { setFilterGroup(v); setSelectedSlot(""); }}><SelectTrigger className="mt-2"><SelectValue placeholder="All groups" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All groups</SelectItem><SelectItem value="none">No group</SelectItem>
                {groups.map((g: any) => (<SelectItem key={g.id} value={g.id}><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: g.color }} />{g.name}</span></SelectItem>))}
              </SelectContent></Select></div>)}
          <div className="flex-1 min-w-52"><label className="text-sm font-medium">Session</label>
            <Select value={selectedSlot} onValueChange={setSelectedSlot}><SelectTrigger className="mt-2"><SelectValue placeholder="Choose a session…" /></SelectTrigger>
              <SelectContent>{(visibleSlots || []).map((s: any) => (<SelectItem key={s.id} value={s.id}><span className="flex items-center gap-1.5">{s.course_groups && <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ backgroundColor: s.course_groups.color }} />}{s.title} — {format(new Date(s.starts_at), "MMM d, h:mm a")}</span></SelectItem>))}</SelectContent>
            </Select></div>
        </div>
        {sd?.course_groups && (<div className="flex items-center gap-2"><span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: sd.course_groups.color }}>{sd.course_groups.name}</span><span className="text-xs text-muted-foreground">{presentCount} present · {absentCount} absent · {students.length - presentCount - absentCount} unmarked</span></div>)}
      </Card>
      {selectedSlot && (<>{rsvps && rsvps.length > 0 && (<div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"><p className="text-sm text-muted-foreground">{rsvps.length} student{rsvps.length !== 1 ? "s" : ""} RSVP’d</p><Button size="sm" variant="outline" onClick={markAllFromRsvp}>Auto-fill from RSVPs</Button></div>)}
        <Card className="overflow-hidden p-0"><div className="divide-y divide-border">
          {students.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No students yet.</p>}
          {students.map((s: any) => { const r = records?.find((x) => x.student_id === s.id); const hasRsvp = rsvps?.some((rv: any) => rv.user_id === s.id); return (
            <div key={s.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{s.display_name?.[0]?.toUpperCase()}</div>
                <div><p className="font-medium">{s.display_name}</p><div className="flex items-center gap-1.5 mt-0.5">{r && <Badge variant={r.status === "present" ? "default" : "destructive"} className="capitalize text-xs">{r.status}</Badge>}{hasRsvp && <Badge variant="outline" className="text-xs">RSVPd</Badge>}</div></div></div>
              <div className="flex gap-2"><Button size="sm" variant={r?.status === "present" ? "default" : "outline"} onClick={() => mark(s.id, "present")}>Present</Button><Button size="sm" variant={r?.status === "absent" ? "destructive" : "outline"} onClick={() => mark(s.id, "absent")}>Absent</Button></div>
            </div>); })}
        </div></Card></>)}
    </div>
  );
}
