import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trophy, ArrowLeft } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — ClubHaus" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode = "signup" } = Route.useSearch();
  const navigate = useNavigate();
  const { user, membership, loading } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">(mode);
  const [busy, setBusy] = useState(false);

  // Sign up state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

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

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="mx-auto max-w-md px-4 py-8">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-hero text-primary-foreground">
            <Trophy className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-semibold">ClubHaus</span>
        </div>
        <Card className="p-6 shadow-elegant">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Sign up</TabsTrigger>
              <TabsTrigger value="login">Log in</TabsTrigger>
            </TabsList>
            <TabsContent value="signup" className="mt-6">
              <h1 className="font-display text-2xl font-semibold">Create your account</h1>
              <p className="mt-1 text-sm text-muted-foreground">You'll pick your role (club admin or member) on the next step.</p>
              <form onSubmit={onSignup} className="mt-6 space-y-4">
                <div><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required /></div>
                <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div><Label htmlFor="password">Password</Label><Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Creating…" : "Create account"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="login" className="mt-6">
              <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
              <form onSubmit={onLogin} className="mt-6 space-y-4">
                <div><Label htmlFor="lemail">Email</Label><Input id="lemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div><Label htmlFor="lpassword">Password</Label><Input id="lpassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Signing in…" : "Log in"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
