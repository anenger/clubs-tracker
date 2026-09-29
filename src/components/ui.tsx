import type { ReactNode } from "react";
import { Info } from "lucide-react";

export function Card({
  title,
  eyebrow,
  action,
  className = "",
  children,
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export type Result = "W" | "D" | "L" | "—";
const resultTone: Record<Result, string> = {
  W: "bg-win/15 text-win",
  D: "bg-draw/15 text-zinc-300",
  L: "bg-loss/15 text-loss",
  "—": "bg-raised text-muted",
};
const resultLabel: Record<Result, string> = {
  W: "Win",
  D: "Draw",
  L: "Loss",
  "—": "Result unavailable",
};

export function ResultChip({
  result,
  size = "md",
}: {
  result: Result;
  size?: "sm" | "md";
}) {
  return (
    <span
      title={resultLabel[result]}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold ${size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm"} ${resultTone[result]}`}
    >
      <span aria-hidden>{result}</span>
      <span className="sr-only">{resultLabel[result]}</span>
    </span>
  );
}

export function ratingTone(rating: number | null | undefined) {
  if (rating == null) return "text-muted";
  if (rating >= 8) return "text-win";
  if (rating >= 7) return "text-zinc-100";
  if (rating >= 6) return "text-amber-300";
  return "text-loss";
}

export function RatingBadge({ rating }: { rating: number | null | undefined }) {
  return (
    <span
      className={`inline-flex min-w-11 justify-center rounded-md bg-raised px-2 py-1 text-sm font-semibold tabular-nums ${ratingTone(rating)}`}
    >
      {rating == null ? "—" : rating.toFixed(1)}
    </span>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg bg-raised p-1 ring-1 ring-white/[.06]"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-8 rounded-md px-3 text-sm font-medium whitespace-nowrap ${value === option.value ? "bg-zinc-100 text-zinc-950" : "text-muted hover:text-zinc-100"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Hover/focus tooltip for secondary context that would otherwise clutter the page. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        className="rounded-full p-0.5 text-muted hover:text-zinc-100"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-zinc-800 p-3 text-xs leading-relaxed font-normal text-zinc-200 shadow-xl ring-1 ring-white/10 group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}

export function YouBadge() {
  return (
    <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">
      YOU
    </span>
  );
}

export function SampleBadge({ title }: { title: string }) {
  return (
    <span
      title={title}
      className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[11px] font-medium text-amber-200"
    >
      Small sample
    </span>
  );
}

/** Bar with the player's value and a marker at the comparison average. */
export function PeerBar({
  value,
  average,
  max,
  higherIsBetter = true,
}: {
  value: number;
  average: number;
  max: number;
  higherIsBetter?: boolean;
}) {
  const scale = (n: number) => `${Math.max(0, Math.min(1, n / max)) * 100}%`;
  const ahead = higherIsBetter ? value >= average : value <= average;
  return (
    <div className="relative mt-3 h-1.5 rounded-full bg-raised" aria-hidden>
      <div
        className={`h-full rounded-full ${ahead ? "bg-win" : "bg-accent"}`}
        style={{ width: scale(value) }}
      />
      <div
        className="absolute -top-1 h-3.5 w-0.5 rounded bg-zinc-200"
        style={{ left: scale(average) }}
      />
    </div>
  );
}

export function Delta({
  value,
  digits = 1,
  suffix = "",
}: {
  value: number;
  digits?: number;
  suffix?: string;
}) {
  const tone = value > 0 ? "text-win" : value < 0 ? "text-loss" : "text-muted";
  return (
    <span className={`text-sm font-medium tabular-nums ${tone}`}>
      {value > 0 ? "+" : value < 0 ? "−" : "±"}
      {Math.abs(value).toFixed(digits)}
      {suffix}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}
