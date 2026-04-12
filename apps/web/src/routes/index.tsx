import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: CodeAtlasHomePage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface StarStyle {
  width: string;
  height: string;
  top: string;
  left: string;
  animationDuration: string;
  animationDelay: string;
  opacity: number;
}

// ── Stars — only mounted on the / route, position:fixed so they fill viewport ─

function Stars() {
  const [stars, setStars] = useState<StarStyle[]>([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 120 }, () => {
        const size = Math.random() < 0.15 ? 2 : 1;
        return {
          width: `${size}px`,
          height: `${size}px`,
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          animationDuration: `${2 + Math.random() * 4}s`,
          animationDelay: `${Math.random() * 5}s`,
          opacity: 0.3 + Math.random() * 0.6,
        };
      }),
    );
  }, []);

  return (
    <div className="ca-stars" aria-hidden="true">
      {stars.map((s, i) => (
        <div
          key={i}
          className="ca-star"
          style={{
            width: s.width,
            height: s.height,
            top: s.top,
            left: s.left,
            animationDuration: s.animationDuration,
            animationDelay: s.animationDelay,
            ["--op" as string]: s.opacity,
          }}
        />
      ))}
    </div>
  );
}

// ── Beam — golden in dark mode, purple in light mode ──────────────────────────

function Beam() {
  return (
    <div className="ca-beam-wrap" aria-hidden="true">
      <div className="ca-beam" />
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroHeadline() {
  return (
    <h1 className="ca-h1">
      EXPLORE
      <br />
      YOUR CODE
      <br />
      <span className="ca-bracket">{"{"}</span>
      <span className="ca-accent"> ATLAS</span>
      <span className="ca-bracket">{" }"}</span>
    </h1>
  );
}

function HeroCTAs() {
  return (
    <div className="ca-hero-ctas">
      <Link to="/onboarding" className="ca-btn-main">
        Get Started <span className="ca-arr">→</span>
      </Link>
      <Link to="/graph" className="ca-btn-outline">
        Open Graph Viewer
      </Link>
    </div>
  );
}

// ── Knowledge Graph SVG mock ───────────────────────────────────────────────────

function KnowledgeGraphSVG() {
  return (
    <svg
      className="ca-graph-svg"
      viewBox="0 0 520 320"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="CodeAtlas knowledge graph visualization"
    >
      <defs>
        <filter id="ca-glow-teal">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ca-glow-purple">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="ca-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgba(128,128,128,0.3)" />
        </marker>
        <pattern id="ca-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.8" fill="rgba(128,128,128,0.08)" />
        </pattern>
      </defs>

      <rect width="520" height="320" fill="url(#ca-grid)" />

      {([
        [190,120,100,80,  "rgba(45,232,200,0.25)"],
        [190,120,100,160, "rgba(45,232,200,0.25)"],
        [190,120,290,80,  "rgba(45,232,200,0.2)"],
        [290,80, 380,60,  "rgba(167,139,250,0.25)"],
        [290,80, 380,110, "rgba(167,139,250,0.25)"],
        [200,210,110,250, "rgba(251,191,36,0.2)"],
        [200,210,290,240, "rgba(251,191,36,0.2)"],
        [100,80, 60, 40,  "rgba(128,128,128,0.15)"],
        [100,160,50, 190, "rgba(128,128,128,0.15)"],
        [380,60, 440,40,  "rgba(167,139,250,0.15)"],
        [380,110,450,130, "rgba(167,139,250,0.15)"],
        [290,240,360,270, "rgba(251,191,36,0.15)"],
      ] as const).map(([x1,y1,x2,y2,stroke], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={stroke} strokeWidth="1.2" markerEnd="url(#ca-arr)" />
      ))}
      <line x1="190" y1="120" x2="200" y2="210"
        stroke="rgba(251,191,36,0.22)" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#ca-arr)" />

      <g filter="url(#ca-glow-teal)">
        <circle cx="190" cy="120" r="20" fill="rgba(45,232,200,0.1)" stroke="#2de8c8" strokeWidth="1.5" />
        <circle cx="190" cy="120" r="6" fill="#2de8c8">
          <animate attributeName="r" values="6;8;6" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.6;1" dur="2.5s" repeatCount="indefinite" />
        </circle>
      </g>
      <text x="190" y="150" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="10" fill="#2de8c8">/src</text>

      <circle cx="100" cy="80" r="12" fill="rgba(45,232,200,0.08)" stroke="rgba(45,232,200,0.4)" strokeWidth="1.2" />
      <circle cx="100" cy="80" r="4.5" fill="rgba(45,232,200,0.7)" />
      <text x="100" y="64" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="9.5" fill="rgba(45,232,200,0.8)">api/</text>

      <circle cx="100" cy="160" r="12" fill="rgba(45,232,200,0.08)" stroke="rgba(45,232,200,0.35)" strokeWidth="1.2" />
      <circle cx="100" cy="160" r="4.5" fill="rgba(45,232,200,0.7)" />
      <text x="100" y="182" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="9.5" fill="rgba(45,232,200,0.8)">lib/</text>

      <g filter="url(#ca-glow-purple)">
        <circle cx="290" cy="80" r="14" fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.5)" strokeWidth="1.5" />
        <circle cx="290" cy="80" r="5" fill="rgba(167,139,250,0.85)">
          <animate attributeName="r" values="5;6.5;5" dur="3s" repeatCount="indefinite" />
        </circle>
      </g>
      <text x="290" y="63" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="9.5" fill="rgba(167,139,250,0.9)">services/</text>

      <circle cx="380" cy="60" r="9" fill="rgba(167,139,250,0.08)" stroke="rgba(167,139,250,0.35)" strokeWidth="1" />
      <circle cx="380" cy="60" r="3.5" fill="rgba(167,139,250,0.65)" />
      <text x="380" y="48" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="8.5" fill="rgba(167,139,250,0.8)">auth.ts</text>

      <circle cx="380" cy="110" r="9" fill="rgba(167,139,250,0.08)" stroke="rgba(167,139,250,0.35)" strokeWidth="1" />
      <circle cx="380" cy="110" r="3.5" fill="rgba(167,139,250,0.65)" />
      <text x="380" y="130" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="8.5" fill="rgba(167,139,250,0.8)">cart.ts</text>

      <circle cx="200" cy="210" r="13" fill="rgba(251,191,36,0.1)" stroke="rgba(251,191,36,0.45)" strokeWidth="1.3" />
      <circle cx="200" cy="210" r="4.5" fill="rgba(251,191,36,0.8)">
        <animate attributeName="r" values="4.5;6;4.5" dur="3.5s" repeatCount="indefinite" />
      </circle>
      <text x="200" y="233" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="9.5" fill="rgba(251,191,36,0.9)">models/</text>

      <circle cx="110" cy="250" r="8" fill="rgba(251,191,36,0.07)" stroke="rgba(251,191,36,0.3)" strokeWidth="1" />
      <circle cx="110" cy="250" r="3" fill="rgba(251,191,36,0.6)" />
      <text x="110" y="269" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="8" fill="rgba(251,191,36,0.7)">User.ts</text>

      <circle cx="290" cy="240" r="8" fill="rgba(251,191,36,0.07)" stroke="rgba(251,191,36,0.3)" strokeWidth="1" />
      <circle cx="290" cy="240" r="3" fill="rgba(251,191,36,0.6)" />
      <text x="290" y="259" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="8" fill="rgba(251,191,36,0.7)">Order.ts</text>

      {([
        [60,40],[50,190],[440,40],[450,130],[360,270],
      ] as const).map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="6"
          fill="rgba(128,128,128,0.05)" stroke="rgba(128,128,128,0.2)" strokeWidth="0.8" />
      ))}

      <text x="145" y="92"  fontFamily="JetBrains Mono,monospace" fontSize="8" fill="rgba(45,232,200,0.35)">CONTAINS</text>
      <text x="230" y="95"  fontFamily="JetBrains Mono,monospace" fontSize="8" fill="rgba(167,139,250,0.35)">IMPORTS</text>
      <text x="175" y="175" fontFamily="JetBrains Mono,monospace" fontSize="8" fill="rgba(251,191,36,0.35)">CALLS</text>
    </svg>
  );
}

// ── Graph sidebar legend ───────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { color: "#2de8c8",               label: "Directories",  count: 12  },
  { color: "rgba(167,139,250,1)",   label: "Source files", count: 847 },
  { color: "rgba(251,191,36,1)",    label: "Models/types", count: 134 },
  { color: "rgba(128,128,128,0.5)", label: "Ext. deps",    count: 22  },
] as const;

function GraphSidebar() {
  return (
    <div className="ca-graph-sidebar">
      <div className="ca-sidebar-label">Legend</div>
      {LEGEND_ITEMS.map(({ color, label, count }) => (
        <div key={label} className="ca-sidebar-row">
          <span className="ca-sidebar-dot" style={{ background: color }} />
          {label}
          <span className="ca-sidebar-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

function GraphCard() {
  return (
    <div className="ca-graph-card">
      <div className="ca-graph-topbar">
        <div className="ca-traffic-lights">
          <div className="ca-tl ca-tl--r" />
          <div className="ca-tl ca-tl--y" />
          <div className="ca-tl ca-tl--g" />
        </div>
        <div className="ca-graph-title">my-ecommerce-api · knowledge graph</div>
        <div className="ca-graph-actions">
          {["⟳", "⊕", "⋯"].map((icon) => (
            <button key={icon} className="ca-graph-btn" type="button">{icon}</button>
          ))}
        </div>
      </div>
      <div className="ca-graph-body">
        <KnowledgeGraphSVG />
        <GraphSidebar />
      </div>
    </div>
  );
}

function HeroRight() {
  return (
    <div className="ca-hero-right">
      <GraphCard />
      <div className="ca-graph-tag">
        node: <strong style={{ color: "var(--teal)" }}>UserService</strong>
        <br />
        type: <span style={{ color: "var(--purple)" }}>class</span>
        {" "}· calls: <span style={{ color: "var(--amber)" }}>14</span>
      </div>
    </div>
  );
}

// ── Footer (home-only) ────────────────────────────────────────────────────────

const SOCIAL_LINKS = [
                                    
  { label: "in", href: "https://www.linkedin.com/in/mariam-ashraf-40309b247/", style: { fontSize: "13px" } as const },
  { label: "⚡", href: "https://github.com/FatmaNageh/CodeAtlas.git"                                 },
] as const;

function FooterBar() {
  return (
    <footer className="ca-footer-bar">
      <div className="ca-footer-left">
        <span className="ca-footer-label">Follow Us</span>
        <div className="ca-socials">
          {SOCIAL_LINKS.map(({ label, href, style }) => (
            <a key={label} href={href} className="ca-social-link" style={style}
              target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ))}
        </div>
      </div>
      <div className="ca-scroll-cta">
        Scroll to explore
        <div className="ca-scroll-btn">↓</div>
      </div>
    </footer>
  );
}




// ── Root ──────────────────────────────────────────────────────────────────────

export function CodeAtlasHomePage() {
  return (
    // overflowX hidden prevents the floating graph card from causing x-scroll
    <div style={{ position: "relative", overflowX: "hidden" }}>

      {/* Background FX — position:fixed, only mounted on the / route */}
      <Stars />
      <Beam />

      {/* Content sits above the fixed FX via z-index */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "calc(100vh - 64px)", /* 54px = shared Header height */
        }}
      >
        {/* Hero */}
        <section className="ca-hero" style={{ flex: 1 }}>
          <div className="ca-hero-left">
            <HeroHeadline />
            <p className="ca-hero-sub">
              Navigate any codebase like a map. CodeAtlas builds a semantic knowledge
              graph of your repository — every file, function, class and relationship,
              instantly traversable.
            </p>
            <HeroCTAs />
          </div>
          <HeroRight />
        </section>

        {/* Footer sits at the bottom of the home page */}
        <FooterBar />
      </div>

    </div>
  );
}

