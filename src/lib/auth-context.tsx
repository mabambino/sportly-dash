import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_parent: boolean;
  dashboard_prefs?: { order?: string[]; layout?: string } | null;
}

interface Membership {
  id: string;
  club_id: string;
  role: "club_owner" | "trainer" | "student" | "parent";
}

interface Club {
  id: string;
  name: string;
  sport: string;
  team_code: string;
  owner_id: string;
  plan: "free" | "pro";
  monthly_fee_cents: number;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  membership: Membership | null;
  club: Club | null;
  loading: boolean;
  isStaff: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (uid: string) => {
    const [{ data: prof }, { data: mems }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("memberships").select("*").eq("user_id", uid).limit(1),
    ]);
    setProfile(prof as Profile | null);
    const m = (mems?.[0] as Membership | undefined) ?? null;
    setMembership(m);
    if (m) {
      const { data: c } = await supabase.from("clubs").select("*").eq("id", m.club_id).maybeSingle();
      setClub(c as Club | null);
    } else {
      setClub(null);
    }
  };

  const refresh = async () => {
    if (user?.id) await load(user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        load(s.user.id).finally(() => setLoading(false));
      } else {
        setProfile(null); setMembership(null); setClub(null); setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) load(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const isStaff = membership?.role === "club_owner" || membership?.role === "trainer";

  return (
    <AuthContext.Provider value={{ user, session, profile, membership, club, loading, isStaff, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
