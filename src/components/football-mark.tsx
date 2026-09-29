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
