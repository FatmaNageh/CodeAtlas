import { Link } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";

export default function Header() {
  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/indexing", label: "Indexing" },
    { to: "/ir", label: "IR Inspector" },
    { to: "/analytics", label: "Analytics" },
    { to: "/graph", label: "Graph Viewer" },

  ] as const;

  return (
    <div className="border-b">
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <nav className="flex flex-wrap gap-4 text-sm sm:text-base">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground font-semibold" }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
