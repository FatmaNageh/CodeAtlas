import { Link, useRouterState } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";

const links = [
  { to: "/",          label: "Home"       },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/indexing",  label: "Indexing"   },
  { to: "/ir",        label: "IR"         },
  { to: "/analytics", label: "Analytics"  },
  { to: "/graph",     label: "Graph"      },
] as const;

export default function Header() {
  const { location } = useRouterState();
  const activePath = location.pathname;

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{
        background: "color-mix(in srgb, var(--s0) 92%, transparent)",
        borderBottom: "1px solid var(--b1)",
      }}
    >
      <div className="mx-auto flex h-[54px] max-w-[1440px] items-center gap-4 px-5">
        {/* Logo */}
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5"
          style={{ textDecoration: "none" }}
        >
          {/* Logo mark */}
          <div
            className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-[8px]"
            style={{
              background: "linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)",
              boxShadow: "0 1px 6px color-mix(in srgb, var(--purple) 35%, transparent)",
            }}
          >
            {/* Tiny graph icon */}
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <circle cx="6"  cy="10" r="2.2" fill="white" fillOpacity="0.9" />
              <circle cx="14" cy="5"  r="1.8" fill="white" fillOpacity="0.75" />
              <circle cx="14" cy="15" r="1.8" fill="white" fillOpacity="0.75" />
              <line x1="8"  y1="9"  x2="12.3" y2="6.1"  stroke="white" strokeOpacity="0.6" strokeWidth="1.2" />
              <line x1="8"  y1="11" x2="12.3" y2="13.9" stroke="white" strokeOpacity="0.6" strokeWidth="1.2" />
            </svg>
          </div>

          <span
            className="text-[15px] font-semibold tracking-[-0.4px]"
            style={{ fontFamily: "var(--font-display, var(--font-sans))", color: "var(--t0)" }}
          >
            Code<span style={{ color: "var(--purple)" }}>Atlas</span>
          </span>
        </Link>

        {/* Divider */}
        <div className="hidden h-[18px] w-px sm:block" style={{ background: "var(--b2)" }} />

        {/* Nav */}
        <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto">
          {links.map(({ to, label }) => {
            const isActive =
              to === "/"
                ? activePath === "/"
                : activePath.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="relative rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                style={{
                  color: isActive ? "var(--t0)" : "var(--t2)",
                  background: isActive ? "var(--s1)" : "transparent",
                }}
                activeProps={{
                  style: { color: "var(--t0)", background: "var(--s1)" },
                }}
              >
                {label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                    style={{ background: "linear-gradient(90deg, var(--purple), var(--blue))" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            to="/onboarding"
            className="hidden items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-[12px] font-medium transition-colors md:inline-flex"
            style={{
              background: "linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)",
              color: "#fff",
              boxShadow: "0 1px 8px color-mix(in srgb, var(--purple) 30%, transparent)",
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Get started
          </Link>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
