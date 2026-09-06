export function CourseBadges({
  minutes,
  exerciseCount,
  hasCapstone,
}: {
  minutes: number;
  exerciseCount: number;
  hasCapstone: boolean;
}) {
  const items = [
    `~${minutes} min`,
    exerciseCount > 0 ? "Exercises" : null,
    hasCapstone ? "Project" : null,
    "Certificate",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((b) => (
        <span
          key={b}
          className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800"
        >
          {b}
        </span>
      ))}
    </div>
  );
}
