// Shared building blocks for the mobile layout.
//
// The home screen is the reference implementation; other screens should reach
// for these rather than re-deriving spacing, radii and type scale by hand.
// Everything here uses existing design tokens — no hard-coded colours — so a
// change to --primary or --radius flows through the whole mobile surface.
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section title with an optional "See all" link, e.g. Courses / Trainers. */
export function SectionHeader({
  title,
  to,
  actionLabel = "See all",
}: {
  title: string;
  to?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {to && (
        <Link to={to} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

/**
 * Full-bleed horizontal scroller. Negative margin + matching padding lets cards
 * bleed to the screen edge while the first one still lines up with the page
 * gutter, which is what makes a rail read as scrollable.
 */
export function Rail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small pill used for times, counts and statuses. */
export function Chip({
  children,
  selected,
  onClick,
  title,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * The wide tappable row from the reference — label on the left, chevron on the
 * right. Used for the next session and for payment prompts.
 */
export function ActionRow({
  to,
  onClick,
  primary,
  children,
  disabled,
}: {
  to?: string;
  onClick?: () => void;
  /** Filled treatment for the one action the screen wants you to take. */
  primary?: boolean;
  children: ReactNode;
  disabled?: boolean;
}) {
  const classes = cn(
    "flex w-full items-center justify-between gap-3 rounded-(--radius) px-4 py-3.5 text-left transition-colors",
    primary
      ? "bg-foreground text-background hover:opacity-90"
      : "bg-card text-foreground shadow-sm hover:bg-secondary",
    disabled && "pointer-events-none opacity-60",
  );
  const inner = (
    <>
      <div className="min-w-0 flex-1">{children}</div>
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full",
          primary ? "bg-background/15" : "bg-secondary",
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes} disabled={disabled}>
      {inner}
    </button>
  );
}

/** Empty-state line that keeps a section's height stable while data loads. */
export function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-(--radius) bg-card px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
