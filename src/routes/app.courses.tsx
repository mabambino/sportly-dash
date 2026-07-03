import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users, Clock, DollarSign, Pencil, Trash2, GraduationCap, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/courses")({
  head: () => ({ meta: [{ title: "Courses — Syncletics" }] }),
  component: CoursesPage,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** One recurring session in a course's weekly schedule. */
interface ScheduleSlot {
  day: string;
  time: string;
  duration: number;
}

interface CourseForm {
  name: string;
  description: string;
  price: string;
  slots: ScheduleSlot[];
}

const EMPTY_FORM: CourseForm = {
  name: "",
  description: "",
  price: "0",
  slots: [{ day: "Mon", time: "17:00", duration: 60 }],
};

/** Read a course's schedule: prefer the flexible schedule_slots column,
 *  fall back to the legacy one-time-for-all-days fields. */
function readSlots(course: any): ScheduleSlot[] {
  if (Array.isArray(course.schedule_slots) && course.schedule_slots.length) {
    return course.schedule_slots.map((s: any) => ({
      day: String(s.day ?? "Mon"),
      time: String(s.time ?? "09:00"),
      duration: Number(s.duration ?? course.session_duration_minutes ?? 60),
    }));
  }
  return (course.schedule_days ?? []).map((day: string) => ({
    day,
    time: course.schedule_time ?? "09:00",
    duration: course.session_duration_minutes ?? 60,
  }));
}

const dayIndex = (d: string) => WEEKDAYS.indexOf(d);

function describeSlots(slots: ScheduleSlot[]): string {
  if (!slots.length) return "No schedule";
  return [...slots]
    .sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.time.localeCompare(b.time))
    .map((s) => `${s.day} ${s.time}`)
    .join(" · ");
}

function CoursesPage() {
  const { club, isStaff } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [rosterFor, setRosterFor] = useState<any | null>(null);

  const { data: courses } = useQuery({
    enabled: !!club,
    queryKey: ["courses", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_groups")
        .select("*")
        .eq("club_id", club!.id)
        .order("created_at");
      return data || [];
    },
  });

  const { data: memberships } = useQuery({
    enabled: !!club,
    queryKey: ["course-memberships", club?.id],
    queryFn: async () => {
      const { data: mems } = await supabase.from("memberships").select("*").eq("club_id", club!.id);
      const ids = (mems || []).map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, display_name, email").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (mems || []).map((m) => ({ ...m, profiles: profs?.find((p) => p.id === m.user_id) }));
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (course: any) => {
    setEditing(course);
    setForm({
      name: course.name ?? "",
      description: course.description ?? "",
      price: String((course.price_cents ?? 0) / 100),
      slots: readSlots(course),
    });
    setDialogOpen(true);
  };

  const updateSlot = (i: number, patch: Partial<ScheduleSlot>) =>
    setForm((f) => ({ ...f, slots: f.slots.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));

  const addSlot = () =>
    setForm((f) => ({ ...f, slots: [...f.slots, { day: "Mon", time: "17:00", duration: 60 }] }));

  const removeSlot = (i: number) =>
    setForm((f) => ({ ...f, slots: f.slots.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!club) return;
    if (!form.name.trim()) {
      toast.error("Course name is required");
      return;
    }
    const slots = form.slots.filter((s) => s.day && s.time);
    // Legacy fields are kept in sync so older code paths keep working.
    const basePayload = {
      club_id: club.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: Math.round(parseFloat(form.price || "0") * 100),
      session_duration_minutes: slots[0]?.duration ?? 60,
      schedule_days: Array.from(new Set(slots.map((s) => s.day))).sort((a, b) => dayIndex(a) - dayIndex(b)),
      schedule_time: slots[0]?.time ?? null,
    };

    const attempt = async (withSlots: boolean) => {
      const payload: any = withSlots ? { ...basePayload, schedule_slots: slots } : basePayload;
      return editing
        ? supabase.from("course_groups").update(payload).eq("id", editing.id)
        : supabase.from("course_groups").insert(payload);
    };

    let { error } = await attempt(true);
    if (error && /schedule_slots/.test(error.message)) {
      // The flexible-schedule column hasn't been migrated yet — save the
      // legacy fields and let the club know.
      ({ error } = await attempt(false));
      if (!error) toast.info("Saved with a single time for all days — run the latest database migration to enable per-day times.");
    }
    if (error) return toast.error(error.message);
    toast.success(editing ? "Course updated" : "Course created");
    setDialogOpen(false);
    qc.invalidateQueries({ queryKey: ["courses"] });
  };

  const remove = async (course: any) => {
    if (!confirm(`Delete "${course.name}"? Enrolled members will be unassigned.`)) return;
    const { error } = await supabase.from("course_groups").delete().eq("id", course.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["course-memberships"] });
    toast.success("Course deleted");
  };

  const rosterOf = (courseId: string) =>
    (memberships || []).filter((m: any) => m.group_id === courseId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Courses</h1>
          <p className="text-sm text-muted-foreground">
            {courses?.length ?? 0} courses · set pricing, schedule and view who is enrolled
          </p>
        </div>
        {isStaff && (
          <Button onClick={openCreate} className="bg-gradient-hero">
            <Plus className="mr-2 h-4 w-4" /> New course
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courses?.map((course: any) => {
          const roster = rosterOf(course.id);
          const slots = readSlots(course);
          return (
            <Card key={course.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-lg text-white"
                    style={{ backgroundColor: course.color || "#6366f1" }}
                  >
                    <GraduationCap className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold leading-tight">{course.name}</p>
                    <p className="text-xs text-muted-foreground">{describeSlots(slots)}</p>
                  </div>
                </div>
                {isStaff && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(course)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(course)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>

              {course.description && (
                <p className="text-sm text-muted-foreground">{course.description}</p>
              )}

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">
                  <DollarSign className="mr-1 h-3 w-3" />
                  {`$${((course.price_cents ?? 0) / 100).toFixed(2)}`}
                </Badge>
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" />
                  {slots.length ? `${slots.length}×/week` : `${course.session_duration_minutes ?? 60} min`}
                </Badge>
                <Badge variant="secondary">
                  <Users className="mr-1 h-3 w-3" />
                  {roster.length} enrolled
                </Badge>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="mt-auto"
                onClick={() => setRosterFor(course)}
              >
                View roster
              </Button>
            </Card>
          );
        })}
        {courses?.length === 0 && (
          <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
            No courses yet.{isStaff ? " Create your first course to get started." : ""}
          </Card>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Course name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="U12 Skills Clinic"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this course covers…"
              />
            </div>
            <div>
              <Label>Price ($ / month)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>

            <div>
              <Label>Weekly schedule</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Add one entry per session — each day can have its own time and length, and a day can have several sessions.
              </p>
              <div className="space-y-2">
                {form.slots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={slot.day} onValueChange={(v) => updateSlot(i, { day: v })}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="time"
                      className="w-28"
                      value={slot.time}
                      onChange={(e) => updateSlot(i, { time: e.target.value })}
                    />
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        min="5"
                        step="5"
                        value={slot.duration}
                        onChange={(e) => updateSlot(i, { duration: parseInt(e.target.value || "60", 10) })}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                    </div>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeSlot(i)} disabled={form.slots.length === 1}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={addSlot}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add session
              </Button>
            </div>

            <Button onClick={save} className="w-full bg-gradient-hero">
              {editing ? "Save changes" : "Create course"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Roster dialog */}
      <Dialog open={!!rosterFor} onOpenChange={(o) => !o && setRosterFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rosterFor?.name} · {rosterOf(rosterFor?.id).length} enrolled
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {rosterOf(rosterFor?.id).map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-sm font-medium">
                    {m.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {m.profiles?.display_name || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.profiles?.email}</p>
                  </div>
                </div>
                <Badge variant="secondary">{m.role}</Badge>
              </div>
            ))}
            {rosterOf(rosterFor?.id).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No members enrolled in this course yet.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
