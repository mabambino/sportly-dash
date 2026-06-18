import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/app/")({
  component: () => {
    const nav = useNavigate();
    useEffect(() => { nav({ to: "/app/dashboard", replace: true }); }, [nav]);
    return null;
  },
});
