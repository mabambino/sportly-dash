import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MessageSquare, CreditCard, Users, BarChart3, Trophy } from "lucide-react";
import logo from "@/assets/logo-syncletics.svg";

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Syncletics" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode = "signup" } = Route.useSearch();
  const navigate = useNavigate();
  const { user, membership, loading } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">(mode);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      if (membership) navigate({ to: "/app/dashboard" });
      else navigate({ to: "/onboarding" });
    }
  }, [user, membership, loading, navigate]);

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name || email.split("@")[0] }, emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    if (error) toast.error(error.message);
    else toast.success("Welcome! Setting up your account…");
    setBusy(false);
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    else toast.success("Welcome back!");
    setBusy(false);
  };

  const isSignup = tab === "signup";

  return (
    <div className="min-h-screen bg-muted/30 lg:p-6">
      <div className="mx-auto grid min-h-screen overflow-hidden rounded-none bg-background shadow-elegant lg:min-h-[calc(100vh-3rem)] lg:grid-cols-2 lg:rounded-2xl">
        {/* Left: form */}
        <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16 lg:py-12">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="Syncletics" className="h-8 w-8" />
              <span className="font-display text-lg font-semibold">Syncletics</span>
            </Link>
            <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {isSignup ? "Create your account" : "Log in to your account"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isSignup ? "Start managing your club in minutes." : "Welcome back! Select method to log in."}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="outline" type="button" className="h-11" onClick={() => toast.info("Google sign-in coming soon")}>
                <GoogleIcon className="mr-2 h-4 w-4" /> Google
              </Button>
              <Button variant="outline" type="button" className="h-11" onClick={() => toast.info("Apple sign-in coming soon")}>
                <AppleIcon className="mr-2 h-4 w-4" /> Apple
              </Button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">or continue with email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={isSignup ? onSignup : onLogin} className="space-y-4">
              {isSignup && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="h-11" required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@club.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" required />
              </div>

              {!isSignup && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} /> Remember me
                  </label>
                  <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => toast.info("Password reset coming soon")}>
                    Forgot Password?
                  </button>
                </div>
              )}

              <Button type="submit" disabled={busy} className="h-11 w-full bg-gradient-hero text-base font-medium">
                {busy ? (isSignup ? "Creating…" : "Signing in…") : isSignup ? "Create account" : "Log in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account? " : "Don't have an account? "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setTab(isSignup ? "login" : "signup")}
              >
                {isSignup ? "Log in" : "Create an account"}
              </button>
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Syncletics. All rights reserved.</p>
        </div>

        {/* Right: hero */}
        <div className="relative hidden overflow-hidden bg-gradient-hero lg:block">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 60%, white 0, transparent 35%)" }} />
          <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
            <div className="flex items-center gap-2 text-sm font-medium opacity-90">
              <Trophy className="h-4 w-4" /> Built for modern sports clubs
            </div>

            <div className="relative">
              {/* Floating feature cards */}
              <div className="relative mx-auto aspect-square max-w-md">
                <FloatingCard className="left-0 top-4" icon={<Calendar className="h-5 w-5" />} title="Today's session" subtitle="U14 · 5:30 PM · Court A" />
                <FloatingCard className="right-0 top-24" icon={<Users className="h-5 w-5" />} title="24 RSVPs" subtitle="3 pending · 1 absent" />
                <FloatingCard className="left-6 bottom-24" icon={<CreditCard className="h-5 w-5" />} title="Payment received" subtitle="€120 · September dues" />
                <FloatingCard className="right-4 bottom-4" icon={<MessageSquare className="h-5 w-5" />} title="New message" subtitle="Coach Mike: Great practice!" />

                {/* Center badge */}
                <div className="absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-white/15 backdrop-blur-xl ring-1 ring-white/30">
                  <BarChart3 className="h-10 w-10" />
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-display text-3xl font-semibold leading-tight">Everything your club needs, in one place.</h2>
              <p className="mt-3 max-w-md text-sm opacity-90">
                Schedule sessions, track attendance, chat with members, and collect payments — all from a single beautifully designed dashboard.
              </p>
              <div className="mt-6 flex gap-1.5">
                <span className="h-1.5 w-8 rounded-full bg-white" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingCard({ className, icon, title, subtitle }: { className?: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className={`absolute flex items-center gap-3 rounded-xl bg-white/95 px-4 py-3 text-foreground shadow-xl ring-1 ring-white/50 backdrop-blur-sm ${className}`}>
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div>
        <div className="text-sm font-semibold leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
  );
}
