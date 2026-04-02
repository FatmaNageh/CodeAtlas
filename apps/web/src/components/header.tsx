import { Link } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";

const links = [
  { to: "/", label: "Product" },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/indexing", label: "Indexing" },
  { to: "/ir", label: "IR" },
  { to: "/analytics", label: "Analytics" },
  { to: "/graph", label: "Graph" },
] as const;

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--b1)] bg-[var(--s0)]/95 backdrop-blur">
      <div className="mx-auto flex h-[50px] max-w-[1400px] items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 text-[14px] font-medium tracking-[-0.3px] text-[var(--t0)]">
          <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[var(--t0)] text-[var(--s0)]">
            <span className="text-[11px]">CA</span>
          </div>
          CodeAtlas
        </Link>

        <div className="hidden h-4 w-px bg-[var(--b1)] sm:block" />

        <nav className="flex flex-1 flex-wrap items-center gap-1 overflow-x-auto">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="rounded-[8px] px-3 py-2 text-[12px] text-[var(--t2)] transition hover:text-[var(--t0)]"
              activeProps={{ className: "rounded-[8px] bg-[var(--s1)] px-3 py-2 text-[var(--t0)]" }}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/onboarding"
            className="hidden rounded-[6px] border border-[var(--b2)] px-3 py-1.5 text-[12px] text-[var(--t1)] hover:bg-[var(--s1)] md:inline-flex"
          >
            Try demo
          </Link>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
