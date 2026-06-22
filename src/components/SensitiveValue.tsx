import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SensitiveValueProps {
  children: ReactNode;
  mask?: string;
  className?: string;
  defaultHidden?: boolean;
}

export function SensitiveValue({ children, mask = "••••", className, defaultHidden = true }: SensitiveValueProps) {
  const [hidden, setHidden] = useState(defaultHidden);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn(hidden && "select-none tracking-wider text-muted-foreground")}>
        {hidden ? mask : children}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setHidden((h) => !h); }}
        className="text-muted-foreground transition hover:text-foreground"
        aria-label={hidden ? "Show value" : "Hide value"}
        title={hidden ? "Show" : "Hide"}
      >
        {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </span>
  );
}
