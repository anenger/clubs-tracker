export function FootballMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="13" />
      <path d="m16 10 6 4-2 7h-8l-2-7 6-4Z M16 10V3 M22 14l6-3 M20 21l4 6 M12 21l-4 6 M10 14l-6-3" />
    </svg>
  );
}

export function PitchMark() {
  return (
    <svg
      viewBox="0 0 280 160"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-0 hidden h-36 -translate-y-1/2 text-white/[.06] lg:block"
    >
      <rect x="10" y="10" width="260" height="140" rx="2" />
      <path d="M140 10v140 M10 40h40v80H10 M270 40h-40v80h40 M10 60h16v40H10 M270 60h-16v40h16" />
      <circle cx="140" cy="80" r="28" />
      <circle cx="140" cy="80" r="2" fill="currentColor" />
    </svg>
  );
}
