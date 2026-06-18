import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, LayoutDashboard, Users, Calendar, ClipboardCheck, MessagesSquare,
  CreditCard, Megaphone, Bell, LogOut, BarChart3, User as UserIcon, Menu, Kanban,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const adminNav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/members", label: "Members", icon: Users },
  { to: "/app/schedule", label: "Schedule", icon: Calendar },
  { to: "/app/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/app/stats", label: "Stats", icon: BarChart3 },
  { to: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/app/chat", label: "Chat", icon: MessagesSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/announcements", label: "Announcements", icon: Megaphone },
];

const memberNav = [
  { to: "/app/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/app/profile", label: "My profile", icon: UserIcon },
  { to: "/app/schedule", label: "Schedule", icon: Calendar },
  { to: "/app/chat", label: "Chat", icon: MessagesSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/announcements", label: "Announcements", icon: Megaphone },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, membership, club, isStaff, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
