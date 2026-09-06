type Props = {
  label: string;
  hue: number;
  title: string;
  className?: string;
};

export function Cover({ label, hue, title, className = "" }: Props) {
  const bg = `hsl(${hue} 55% 42%)`;
  const bg2 = `hsl(${(hue + 28) % 360} 60% 32%)`;
  return (
    <div
      className={`relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-xl p-5 text-white shadow-sm ${className}`}
      style={{ background: `linear-gradient(135deg, ${bg}, ${bg2})` }}
      aria-hidden
    >
      <div className="text-xs font-medium uppercase tracking-wider opacity-90">{label}</div>
      <div className="text-lg font-semibold leading-snug sm:text-xl">{title}</div>
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-8 right-8 h-24 w-24 rounded-full bg-black/10" />
    </div>
  );
}
