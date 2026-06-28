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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users, Clock, DollarSign, Pencil, Trash2, GraduationCap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/courses")({
  head: () => ({ meta: [{ title: "Courses — Syncletics" }] }),
  component: CoursesPage,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CourseForm {
  name: string;
  description: string;
  price: string;
  duration: string;
  days: string[];
  time: string;
}

const EMPTY_FORM: CourseForm = {
  name: "",
  description: "",
  price: "0",
  duration: "60",
  days: [],
  time: "09:00",
};

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
      const { data } = await supabase
        .from("memberships")
        .select("*, profiles(display_name, email)")
        .eq("club_id", club!.id);
      return data || [];
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
      duration: String(course.session_duration_minutes ?? 60),
      days: course.schedule_days ?? [],
      time: course.schedule_time ?? "09:00",
    });
    setDialogOpen(true);
  };

  const toggleDay = (day: string) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day],
    }));

  const save = async () => {
    if (!club) return;
    if (!form.name.trim()) {
      toast.error("Course name is required");
      return;
    }
    const payload = {
      club_id: club.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: Math.round(parseFloat(form.price || "0") * 100),
      session_duration_minutes: parseInt(form.duration || "60", 10),
      schedule_days: form.days,
      schedule_time: form.time,
    };
    if (editing) {
      const { error } = await supabase
        .from("course_groups")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Course updated");
    } else {
      const { error } = await supabase.from("course_groups").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Course created");
    }
    setDialogOpen(false);
    qc.invalidateQueries({ queryKey: ["courses"] });
  };

  const remove = async (course: any) => {
    if (!confirm(\`Delete "\${course.name}"? Enrolled members will be unassigned.\`)) return;
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
            {courses?.length ?? 0} courses · set pricing and view who is enrolled
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
                    <p className="text-xs text-muted-foreground">
                      {course.schedule_days?.length
                        ? course.schedule_days.join(", ")
                        : "No schedule"}
                    </p>
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
                  {\`\${((course.price_cents ?? 0) / 100).toFixed(2)}\`}
                </Badge>
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" />
                  {course.session_duration_minutes ?? 60} min
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
        <DialogContent>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Session length (min)</Label>
                <Input
                  type="number"
                  min="0"
                  step="5"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Schedule</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {WEEKDAYS.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={form.days.includes(d) ? "default" : "outline"}
                    onClick={() => toggleDay(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
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
