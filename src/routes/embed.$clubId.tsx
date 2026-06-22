import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getEmbedStats } from "@/lib/embed.functions";
import { Users, CalendarCheck, Trophy, MapPin } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/embed/$clubId")({
  head: () => ({ meta: [{ title: "Club widget — ClubHaus" }] }),
  component: EmbedWidget,
});

function EmbedWidget() {
  const { clubId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["embed", clubId],
    queryFn: () => getEmbedStats({ data: { clubId } }),
  });

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Club not found</div>;

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{data.club.sport || "Sports club"}</p>
          <h1 className="font-display text-2xl font-semibold">{data.club.name}</h1>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Users} label="Members" value={data.stats.members} />
          <Stat icon={Trophy} label="Students" value={data.stats.students} />
          <Stat icon={CalendarCheck} label="Attendance" value={`${data.stats.attRate}%`} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Upcoming sessions</p>
          <div className="mt-3 divide-y divide-border">
            {data.upcoming.length === 0 && <p className="py-3 text-xs text-muted-foreground">No upcoming sessions.</p>}
            {data.upcoming.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(s.starts_at), "EEE MMM d, h:mm a")}</p>
                </div>
                {s.location && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {s.location}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          Powered by ClubHaus
        </p>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 font-display text-xl font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
