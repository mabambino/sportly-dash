import { useState, type ReactNode } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/lib/user-settings";

interface SensitiveValueProps {
  children: ReactNode;
  mask?: string;
  className?: string;
  defaultHidden?: boolean;
}

export function SensitiveValue({ children, mask = "••••", className, defaultHidden = true }: SensitiveValueProps) {
  const { hideAll } = usePrivacy();
  const [hidden, setHidden] = useState(defaultHidden);
  // When global privacy mode is on it wins over the per-value toggle: the value
  // stays masked and the reveal button is locked.
  const effectiveHidden = hideAll || hidden;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn(effectiveHidden && "select-none tracking-wider text-muted-foreground")}>
        {effectiveHidden ? mask : children}
      </span>
      {hideAll ? (
        <Lock className="h-4 w-4 text-muted-foreground" aria-label="Hidden by privacy mode" />
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setHidden((h) => !h); }}
          className="text-muted-foreground transition hover:text-foreground"
          aria-label={hidden ? "Show value" : "Hide value"}
          title={hidden ? "Show" : "Hide"}
        >
          {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      )}
    </span>
  );
}
