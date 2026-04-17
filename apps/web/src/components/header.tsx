import { Link, useRouterState } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";

const NAV_LINKS = [
  { to: "/",           label: "Home"         },
  { to: "/graph",      label: "Graph"        },
  { to: "/history",    label: "History"      },
  { to: "/onboarding", label: "Onboarding"   },
  { to: "/faquestions", label: "FAQ"         },
] as const;

export default function Header() {
  const { location } = useRouterState();
  const activePath = location.pathname;

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{
        background: "color-mix(in srgb, var(--bg) 82%, transparent)",
        borderBottom: "1px solid var(--b1)",
        height: "64px",
      }}
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-6">

        {/* ── Logo ── */}
        <Link
          to="/"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}
        >
          <div
            style={{
              width: 34, height: 34,
              background: 0,
              borderRadius: 9,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 8px color-mix(in srgb, var(--purple) 35%, transparent)",
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
              <circle cx="6"  cy="10" r="2.2" fill="white" fillOpacity="0.9" />
              <circle cx="14" cy="5"  r="1.8" fill="white" fillOpacity="0.75" />
              <circle cx="14" cy="15" r="1.8" fill="white" fillOpacity="0.75" />
              <line x1="8"  y1="9"  x2="12.3" y2="6.1"  stroke="white" strokeOpacity="0.6" strokeWidth="1.2" />
              <line x1="8"  y1="11" x2="12.3" y2="13.9" stroke="white" strokeOpacity="0.6" strokeWidth="1.2" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              color: "var(--t0)",
            }}
          >
            Code<span style={{ color: "var(--purple)" }}>Atlas</span>
          </span>
        </Link>

        {/* ── Pill nav ── */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            background: "color-mix(in srgb, var(--t0) 5%, transparent)",
            border: "1px solid var(--b1)",
            borderRadius: 100,
            padding: "5px 6px",
          }}
        >
          {NAV_LINKS.map(({ to, label }) => {
            const isActive = to === "/" ? activePath === "/" : activePath.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 16px",
                  borderRadius: 100,
                  fontSize: 13.5,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "var(--t0)" : "var(--t2)",
                  background: isActive ? "color-mix(in srgb, var(--t0) 9%, transparent)" : "transparent",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s, background 0.15s",
                }}
              >
                {isActive && (
                  <span
                    style={{
                      width: 6, height: 6,
                      borderRadius: "50%",
                      background: "var(--teal)",
                      boxShadow: "0 0 5px var(--teal)",
                      flexShrink: 0,
                    }}
                  />
                )}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* ── Right actions ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ModeToggle />
          <Link
            to="/onboarding"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 20px",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: 0,
              boxShadow: "0 2px 12px color-mix(in srgb, var(--purple) 32%, transparent)",
              textDecoration: "none",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Get started
          </Link>
        </div>

      </div>
    </header>
  );
}