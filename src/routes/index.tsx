import { createFileRoute, redirect } from "@tanstack/react-router";

// The marketing/landing page lives in a separate app now, so the root URL
// sends visitors straight to the login page. Logged-in users are forwarded
// on to their dashboard by the auth route itself.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { mode: "login" } });
  },
  component: () => null,
});
