import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, CalendarCheck, MessagesSquare, BarChart3, CreditCard, Users, Shield, ArrowRight, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClubHaus — Run your sports club from one place" },
      { name: "description", content: "Members, schedule, attendance, real-time chat and payments. Built for clubs, trainers, students and parents." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-hero text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">ClubHaus</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" search={{ mode: "login" }}>
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="sm" className="bg-gradient-hero shadow-elegant">Try the demo</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-subtle" />
        <div className="absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 text-center sm:pt-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Trusted by 200+ clubs in beta
          </div>
          <h1 className="mx-auto max-w-3xl font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            Run your sports club <span className="text-gradient">from one place.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Members, schedule, attendance, real-time chat and monthly payments — all in a single, modern platform built for trainers, students and parents.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="bg-gradient-hero shadow-elegant">
                Try the demo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth" search={{ mode: "login" }}>
              <Button size="lg" variant="outline">I have an account</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required • Free for up to 15 members</p>

          {/* Hero mock */}
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-elegant">
              <div className="rounded-xl bg-gradient-subtle p-6 sm:p-10">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "Active members", value: "47", trend: "+12 this month" },
                    { label: "Attendance rate", value: "92%", trend: "Last 30 days" },
                    { label: "Monthly revenue", value: "$2,350", trend: "+18% vs last" },
                  ].map((s) => (
                    <Card key={s.label} className="p-5 text-left">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      <p className="mt-2 font-display text-3xl font-semibold">{s.value}</p>
                      <p className="mt-1 text-xs text-success">{s.trend}</p>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">Everything you need</p>
            <h2 className="mt-3 font-display text-4xl font-semibold">Built for how clubs actually work</h2>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Users, title: "Member management", desc: "Roster, approvals, parent accounts and student profiles in one tidy view." },
              { icon: CalendarCheck, title: "Schedule & RSVP", desc: "Create training slots with capacity. Members RSVP straight from their phone." },
              { icon: BarChart3, title: "Stats & progress", desc: "Track configurable metrics, attendance trends and earned achievement badges." },
              { icon: MessagesSquare, title: "Real-time chat", desc: "One-on-one and group conversations between trainers, students and parents." },
              { icon: CreditCard, title: "Monthly fees", desc: "Subscription billing with paid/overdue status at a glance." },
              { icon: Shield, title: "Roles & permissions", desc: "Owners, trainers, students and parents — each sees exactly what they need." },
            ].map((f) => (
              <Card key={f.title} className="p-6 hover:shadow-elegant transition-shadow">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">How it works</p>
            <h2 className="mt-3 font-display text-4xl font-semibold">Set up in under five minutes</h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {[
              { n: "1", t: "Create your club", d: "Sign up as a club admin. Get a unique team code instantly." },
              { n: "2", t: "Share the code", d: "Students and parents join by entering your team code. No invites needed." },
              { n: "3", t: "Run your club", d: "Schedule sessions, track attendance, chat, collect fees." },
            ].map((s) => (
              <div key={s.n} className="relative">
                <div className="font-display text-6xl font-semibold text-gradient">{s.n}</div>
                <h3 className="mt-3 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">Pricing</p>
            <h2 className="mt-3 font-display text-4xl font-semibold">Simple, fair pricing for clubs</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when your club grows past 15 members.</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
            <Card className="p-8">
              <p className="text-sm font-medium text-muted-foreground">Free</p>
              <p className="mt-2 font-display text-5xl font-semibold">$0</p>
              <p className="mt-1 text-sm text-muted-foreground">per month, forever</p>
              <ul className="mt-6 space-y-3 text-sm">
                {["Up to 15 members", "Unlimited sessions", "Real-time chat", "Attendance tracking", "Email support"].map((x) => (
                  <li key={x} className="flex gap-2"><Check className="h-5 w-5 text-success" /> {x}</li>
                ))}
              </ul>
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button variant="outline" className="mt-8 w-full">Start free</Button>
              </Link>
            </Card>
            <Card className="relative border-primary p-8 shadow-elegant">
              <span className="absolute -top-3 right-6 rounded-full bg-gradient-hero px-3 py-1 text-xs font-medium text-primary-foreground">Most popular</span>
              <p className="text-sm font-medium text-primary">Pro</p>
              <p className="mt-2 font-display text-5xl font-semibold">$29</p>
              <p className="mt-1 text-sm text-muted-foreground">per month, billed monthly</p>
              <ul className="mt-6 space-y-3 text-sm">
                {["Unlimited members", "Everything in Free", "Stripe billing for member fees", "Performance stats & badges", "CSV exports", "Priority support"].map((x) => (
                  <li key={x} className="flex gap-2"><Check className="h-5 w-5 text-success" /> {x}</li>
                ))}
              </ul>
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button className="mt-8 w-full bg-gradient-hero">Try Pro free</Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="overflow-hidden rounded-3xl bg-gradient-hero p-12 text-center text-primary-foreground shadow-elegant sm:p-16">
            <h2 className="font-display text-4xl font-semibold">Ready to see it in action?</h2>
            <p className="mx-auto mt-3 max-w-xl opacity-90">Sign up, click "Load demo data" and explore a fully populated club in 30 seconds.</p>
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" variant="secondary" className="mt-8">
                Try the demo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span>© 2026 ClubHaus. All rights reserved.</span>
          </div>
          <p>Built for clubs that mean business.</p>
        </div>
      </footer>
    </div>
  );
}
