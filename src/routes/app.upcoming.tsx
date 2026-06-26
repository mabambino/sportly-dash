import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Bell, Smartphone, Trophy, CalendarClock, Building2,
  Globe, Brain, Wallet, ListChecks,
} from "lucide-react";

export const Route = createFileRoute("/app/upcoming")({
  head: () => ({ meta: [{ title: "Upcoming — Syncletics" }] }),
  component: UpcomingPage,
});

type Status = "In progress" | "Planned" | "Exploring";

const statusStyle: Record<Status, string> = {
  "In progress": "border-primary/20 bg-primary/10 text-primary",
  Planned: "border-border bg-muted text-muted-foreground",
  Exploring: "border-border bg-accent text-accent-foreground",
};

type Feature = {
  icon: typeof Sparkles;
  title: string;
  desc: string;
  status: Status;
};

const features: Feature[] = [
  {
    icon: Bell,
    title: "Automated fee reminders",
    desc: "Smart nudges before and after a payment is due, keeping paid and overdue status always up to date.",
    status: "In progress",
  },
  {
    icon: Smartphone,
    title: "iOS & Android apps",
    desc: "Native mobile apps so trainers, students and parents get push notifications and RSVP on the go.",
    status: "Planned",
  },
  {
    icon: Trophy,
    title: "Badges & gamification",
    desc: "Achievement badges and streaks built on top of attendance and performance stats.",
    status: "In progress",
  },
  {
    icon: CalendarClock,
    title: "Calendar sync",
    desc: "Two-way sync of sessions and fixtures with Google and Apple calendars.",
    status: "Planned",
  },
  {
    icon: Building2,
    title: "Multi-club & federations",
    desc: "Run several clubs or a whole league from one account, with shared reporting.",
    status: "Exploring",
  },
  {
    icon: Globe,
    title: "Public club pages",
    desc: "A shareable club page with online registration alongside the existing team-code join flow.",
    status: "Planned",
  },
  {
    icon: Brain,
    title: "AI attendance insights",
    desc: "Spot drop-off risk early with trends and suggested follow-ups for trainers.",
    status: "Exploring",
  },
  {
    icon: Wallet,
    title: "Payouts dashboard",
    desc: "A clear view of Stripe Connect payouts, processing fees and upcoming transfers.",
    status: "Planned",
  },
  {
    icon: ListChecks,
    title: "Waitlists & capacity",
    desc: "Automatic waitlists and overflow handling when a session reaches capacity.",
    status: "Planned",
  },
];

function UpcomingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-hero text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold">Upcoming features</h1>
          <p className="text-sm text-muted-foreground">
            What we're building next for your club. This roadmap is indicative and may change.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className="flex flex-col gap-3 p-5 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <Badge variant="outline" className={statusStyle[f.status]}>
                {f.status}
              </Badge>
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-hero p-6 text-primary-foreground">
        <h2 className="font-display text-xl font-semibold">Have a request?</h2>
        <p className="mt-1 text-sm opacity-90">
          Tell us what would make Syncletics better for your club — your feedback shapes what we ship next.
        </p>
      </Card>
    </div>
  );
}
