import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm text-white">
            SP
          </span>
          <span>SkillPulse</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
          <Link href="/" className="hover:text-violet-600">
            Catalog
          </Link>
          <Link href="/admin" className="hover:text-violet-600">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
