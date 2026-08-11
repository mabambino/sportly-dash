// Horizontal week selector: one column per day, selected day filled, a dot
// under any day that has sessions. Mirrors the "Today 12 May" strip from the
// mobile layout reference.
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

export function DayStrip({
  selected,
  onSelect,
  /** Days that have at least one session, used to place the indicator dot. */
  markedDates = [],
  weekStartsOn = 1,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  markedDates?: Date[];
  weekStartsOn?: 0 | 1;
}) {
  const start = startOfWeek(selected, { weekStartsOn });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();

  return (
    <div className="flex items-stretch justify-between gap-1.5">
      {days.map((day) => {
        const isSelected = isSameDay(day, selected);
        const isToday = isSameDay(day, today);
        const hasSessions = markedDates.some((d) => isSameDay(d, day));
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={isSelected}
            aria-label={format(day, "EEEE d MMMM")}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-full py-2 transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-secondary",
            )}
          >
            <span
              className={cn(
                "text-[11px] font-medium uppercase",
                isSelected ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {format(day, "EEEEE")}
            </span>
            <span className="text-sm font-semibold tabular-nums">{format(day, "d")}</span>
            {/* Reserve the dot's height on every day so the row never shifts. */}
            <span
              className={cn(
                "h-1 w-1 rounded-full",
                hasSessions
                  ? isSelected
                    ? "bg-primary-foreground"
                    : isToday
                      ? "bg-primary"
                      : "bg-muted-foreground/50"
                  : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
