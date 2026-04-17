import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: CodeAtlasHomePage,
});

interface StarStyle {
  width: string;
  height: string;
  top: string;
  left: string;
  animationDuration: string;
  animationDelay: string;
  opacity: number;
}

function useInView(threshold = 0.25) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

function useCountUp(target: number, duration = 1400, start = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;

    let raf = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);

  return count;
}

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

function Beam() {
  return (
    <div className="ca-beam-wrap" aria-hidden="true">
      <div className="ca-beam" />
    </div>
  );
}

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
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ca-glow-purple">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="ca-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgba(148,163,184,0.35)" />
        </marker>
        <pattern id="ca-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.8" fill="rgba(148,163,184,0.08)" />
        </pattern>
      </defs>

      <rect width="520" height="320" fill="url(#ca-grid)" />

      {([
        [190, 120, 100, 80, "rgba(45,232,200,0.25)"],
        [190, 120, 100, 165, "rgba(45,232,200,0.25)"],
        [190, 120, 290, 82, "rgba(45,232,200,0.22)"],
        [290, 82, 392, 58, "rgba(167,139,250,0.25)"],
        [290, 82, 385, 118, "rgba(167,139,250,0.25)"],
        [200, 215, 115, 255, "rgba(251,191,36,0.2)"],
        [200, 215, 295, 245, "rgba(251,191,36,0.2)"],
      ] as const).map(([x1, y1, x2, y2, stroke], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth="1.2"
          markerEnd="url(#ca-arr)"
        />
      ))}

      <line
        x1="190"
        y1="120"
        x2="200"
        y2="215"
        stroke="rgba(251,191,36,0.22)"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        markerEnd="url(#ca-arr)"
      />

      <g filter="url(#ca-glow-teal)">
        <circle
          cx="190"
          cy="120"
          r="20"
          fill="rgba(45,232,200,0.1)"
          stroke="#2de8c8"
          strokeWidth="1.5"
        />
        <circle cx="190" cy="120" r="6" fill="#2de8c8">
          <animate attributeName="r" values="6;8;6" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.6;1" dur="2.5s" repeatCount="indefinite" />
        </circle>
      </g>
      <text
        x="190"
        y="150"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="10"
        fill="#2de8c8"
      >
        /src
      </text>

      <circle
        cx="100"
        cy="80"
        r="12"
        fill="rgba(45,232,200,0.08)"
        stroke="rgba(45,232,200,0.4)"
        strokeWidth="1.2"
      />
      <circle cx="100" cy="80" r="4.5" fill="rgba(45,232,200,0.7)" />
      <text
        x="100"
        y="64"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="9.5"
        fill="rgba(45,232,200,0.85)"
      >
        routes/
      </text>

      <circle
        cx="100"
        cy="165"
        r="12"
        fill="rgba(45,232,200,0.08)"
        stroke="rgba(45,232,200,0.35)"
        strokeWidth="1.2"
      />
      <circle cx="100" cy="165" r="4.5" fill="rgba(45,232,200,0.7)" />
      <text
        x="100"
        y="188"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="9.5"
        fill="rgba(45,232,200,0.85)"
      >
        lib/
      </text>

      <g filter="url(#ca-glow-purple)">
        <circle
          cx="290"
          cy="82"
          r="14"
          fill="rgba(167,139,250,0.1)"
          stroke="rgba(167,139,250,0.5)"
          strokeWidth="1.5"
        />
        <circle cx="290" cy="82" r="5" fill="rgba(167,139,250,0.85)">
          <animate attributeName="r" values="5;6.5;5" dur="3s" repeatCount="indefinite" />
        </circle>
      </g>
      <text
        x="290"
        y="64"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="9.5"
        fill="rgba(167,139,250,0.9)"
      >
        services/
      </text>

      <circle
        cx="392"
        cy="58"
        r="9"
        fill="rgba(167,139,250,0.08)"
        stroke="rgba(167,139,250,0.35)"
        strokeWidth="1"
      />
      <circle cx="392" cy="58" r="3.5" fill="rgba(167,139,250,0.65)" />
      <text
        x="392"
        y="46"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="8.5"
        fill="rgba(167,139,250,0.8)"
      >
        auth.ts
      </text>

      <circle
        cx="385"
        cy="118"
        r="9"
        fill="rgba(167,139,250,0.08)"
        stroke="rgba(167,139,250,0.35)"
        strokeWidth="1"
      />
      <circle cx="385" cy="118" r="3.5" fill="rgba(167,139,250,0.65)" />
      <text
        x="385"
        y="138"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="8.5"
        fill="rgba(167,139,250,0.8)"
      >
        graph.ts
      </text>

      <circle
        cx="200"
        cy="215"
        r="13"
        fill="rgba(251,191,36,0.1)"
        stroke="rgba(251,191,36,0.45)"
        strokeWidth="1.3"
      />
      <circle cx="200" cy="215" r="4.5" fill="rgba(251,191,36,0.8)">
        <animate attributeName="r" values="4.5;6;4.5" dur="3.5s" repeatCount="indefinite" />
      </circle>
      <text
        x="200"
        y="238"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="9.5"
        fill="rgba(251,191,36,0.92)"
      >
        ast/
      </text>

      <circle
        cx="115"
        cy="255"
        r="8"
        fill="rgba(251,191,36,0.07)"
        stroke="rgba(251,191,36,0.3)"
        strokeWidth="1"
      />
      <circle cx="115" cy="255" r="3" fill="rgba(251,191,36,0.6)" />
      <text
        x="115"
        y="274"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="8"
        fill="rgba(251,191,36,0.7)"
      >
        ir.ts
      </text>

      <circle
        cx="295"
        cy="245"
        r="8"
        fill="rgba(251,191,36,0.07)"
        stroke="rgba(251,191,36,0.3)"
        strokeWidth="1"
      />
      <circle cx="295" cy="245" r="3" fill="rgba(251,191,36,0.6)" />
      <text
        x="295"
        y="264"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="8"
        fill="rgba(251,191,36,0.7)"
      >
        schema.ts
      </text>

      <text
        x="145"
        y="92"
        fontFamily="JetBrains Mono, monospace"
        fontSize="8"
        fill="rgba(45,232,200,0.4)"
      >
        CONTAINS
      </text>
      <text
        x="235"
        y="98"
        fontFamily="JetBrains Mono, monospace"
        fontSize="8"
        fill="rgba(167,139,250,0.38)"
      >
        IMPORTS
      </text>
      <text
        x="176"
        y="180"
        fontFamily="JetBrains Mono, monospace"
        fontSize="8"
        fill="rgba(251,191,36,0.38)"
      >
        DECLARES
      </text>
    </svg>
  );
}

const LEGEND_ITEMS = [
  { color: "#2de8c8", label: "Directories", count: 12 },
  { color: "rgba(167,139,250,1)", label: "Code files", count: 48 },
  { color: "rgba(251,191,36,1)", label: "AST / IR", count: 26 },
  { color: "rgba(148,163,184,0.7)", label: "Relations", count: 9 },
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
        <div className="ca-graph-title">codeatlas-demo · knowledge graph</div>
        <div className="ca-graph-actions">
          {["⟳", "⊕", "⋯"].map((icon) => (
            <button key={icon} className="ca-graph-btn" type="button">
              {icon}
            </button>
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
        type: <span style={{ color: "var(--purple)" }}>class</span> · relation:
        <span style={{ color: "var(--amber)" }}> DECLARES</span>
      </div>
    </div>
  );
}

const STATS = [
  { value: 6, suffix: "", label: "Core node types" },
  { value: 12, suffix: "+", label: "Supported languages (planned/core set)" },
  { value: 11, suffix: "", label: "Main graph relations" },
  { value: 1, suffix: "", label: "Canonical graph schema" },
] as const;

function StatItem({
  value,
  suffix,
  label,
  start,
}: {
  value: number;
  suffix: string;
  label: string;
  start: boolean;
}) {
  const count = useCountUp(value, 1500, start);

  return (
    <div className="ca-stat-item">
      <div className="ca-stat-value">
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="ca-stat-label">{label}</div>
    </div>
  );
}

function StatsBar() {
  const { ref, inView } = useInView(0.2);

  return (
    <section className="ca-stats-section">
      <div ref={ref} className="ca-stats-bar">
        {STATS.map((s) => (
          <StatItem key={s.label} {...s} start={inView} />
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: "◈",
    color: "var(--teal)",
    title: "Repository knowledge graph",
    desc: "Turn repositories into an explorable graph of files, folders, chunks, AST nodes, and semantic relationships.",
  },
  {
    icon: "⌘",
    color: "var(--purple)",
    title: "Graph-based code exploration",
    desc: "Trace imports, declarations, extensions, and references visually instead of jumping between disconnected files.",
  },
  {
    icon: "◎",
    color: "var(--amber)",
    title: "Impact and dependency analysis",
    desc: "Understand what depends on what before changing a file, deleting a function, or refactoring shared logic.",
  },
  {
    icon: "⊞",
    color: "var(--blue)",
    title: "Incremental indexing",
    desc: "Re-index only what changed and keep the graph aligned with the real repository state.",
  },
  {
    icon: "✦",
    color: "var(--green)",
    title: "Diagnostics and validation",
    desc: "Inspect graph quality, schema consistency, missing properties, and indexing health through dedicated debug views.",
  },
  {
    icon: "▣",
    color: "var(--coral)",
    title: "Web + VS Code experience",
    desc: "Explore the same repository understanding workflow through both the web interface and the extension environment.",
  },
] as const;

function FeaturesSection() {
  return (
    <section className="ca-section ca-features-section">
      <div className="ca-section-inner">
        <div className="ca-section-header">
          <span className="ca-section-tag">Core capabilities</span>
          <h2 className="ca-section-h2">A codebase is more than a file tree</h2>
          <p className="ca-section-desc">
            CodeAtlas helps developers understand structure, dependencies, declarations, and repository-wide impact from one coherent view.
          </p>
        </div>

        <div className="ca-features-grid">
          {FEATURES.map(({ icon, color, title, desc }) => (
            <article key={title} className="ca-feature-card">
              <div
                className="ca-feature-icon"
                style={{
                  color,
                  borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
                  background: `color-mix(in srgb, ${color} 8%, transparent)`,
                }}
              >
                {icon}
              </div>
              <h3 className="ca-feature-title">{title}</h3>
              <p className="ca-feature-desc">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    num: "01",
    color: "var(--teal)",
    title: "Select a repository",
    desc: "Choose a local project and let CodeAtlas scan the repository structure while respecting ignore rules and stable path handling.",
  },
  {
    num: "02",
    color: "var(--purple)",
    title: "Build the graph",
    desc: "Parse supported files, normalize extracted facts into IR, and persist a clean canonical Neo4j graph with deterministic IDs.",
  },
  {
    num: "03",
    color: "var(--amber)",
    title: "Explore and analyze",
    desc: "Navigate the graph, inspect node details, validate indexing output, and answer architecture questions with more confidence.",
  },
] as const;

function HowItWorksSection() {
  return (
    <section className="ca-section ca-how-section">
      <div className="ca-section-inner">
        <div className="ca-section-header">
          <span className="ca-section-tag">How it works</span>
          <h2 className="ca-section-h2">From raw repository to understandable system</h2>
        </div>

        <div className="ca-steps">
          {STEPS.map(({ num, color, title, desc }) => (
            <div key={num} className="ca-step">
              <div
                className="ca-step-num"
                style={{
                  color,
                  borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                  background: `color-mix(in srgb, ${color} 6%, transparent)`,
                }}
              >
                {num}
              </div>
              <div>
                <h3 className="ca-step-title">{title}</h3>
                <p className="ca-step-desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const ENTITY_CARDS = [
  {
    title: "Node types",
    items: ["Repo", "Directory", "CodeFile", "TextFile", "TextChunk", "AstNode"],
  },
  {
    title: "Core relations",
    items: ["CONTAINS", "HAS_CHUNK", "NEXT_CHUNK", "DECLARES", "HAS_AST_ROOT", "AST_CHILD"],
  },
  {
    title: "Semantic relations",
    items: ["IMPORTS", "EXTENDS", "OVERRIDES", "DESCRIBES", "MENTIONS", "REFERENCES"],
  },
] as const;

function GraphModelSection() {
  return (
    <section className="ca-section ca-graphmodel-section">
      <div className="ca-section-inner">
        <div className="ca-section-header">
          <span className="ca-section-tag">Graph model</span>
          <h2 className="ca-section-h2">Designed around a clean canonical schema</h2>
          <p className="ca-section-desc">
            CodeAtlas keeps one consistent graph model so indexing, querying, debugging, and visualization all speak the same language.
          </p>
        </div>

        <div className="ca-model-grid">
          {ENTITY_CARDS.map((card) => (
            <div key={card.title} className="ca-model-card">
              <h3 className="ca-model-title">{card.title}</h3>
              <div className="ca-chip-wrap">
                {card.items.map((item) => (
                  <span key={item} className="ca-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const USE_CASES = [
  {
    title: "Onboarding faster",
    desc: "New developers can see how folders, files, and declarations connect instead of reverse-engineering the repo manually.",
  },
  {
    title: "Safer refactoring",
    desc: "Trace what imports, extends, overrides, or references a component before editing it.",
  },
  {
    title: "Architecture understanding",
    desc: "Inspect how services, routes, models, and utility layers are actually connected in the codebase.",
  },
  {
    title: "Validation and debugging",
    desc: "Use diagnostics pages and graph-level checks to catch schema mismatches, missing nodes, and indexing inconsistencies.",
  },
] as const;

function UseCasesSection() {
  return (
    <section className="ca-section ca-usecases-section">
      <div className="ca-section-inner">
        <div className="ca-section-header">
          <span className="ca-section-tag">Why it matters</span>
          <h2 className="ca-section-h2">Built for real repository understanding tasks</h2>
        </div>

        <div className="ca-usecase-grid">
          {USE_CASES.map((item) => (
            <div key={item.title} className="ca-usecase-card">
              <h3 className="ca-usecase-title">{item.title}</h3>
              <p className="ca-usecase-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const ARCH_BLOCKS = [
  {
    label: "Input",
    title: "Repository scan",
    text: "Project selection, ignore rules, classification, deterministic traversal, and stable relative paths.",
  },
  {
    label: "Processing",
    title: "Parsing + IR normalization",
    text: "Language-aware extraction feeds a strict intermediate representation before anything reaches the graph.",
  },
  {
    label: "Persistence",
    title: "Neo4j graph storage",
    text: "Canonical node labels, fixed relationship vocabulary, deterministic IDs, and schema constraints.",
  },
  {
    label: "Product",
    title: "Exploration + diagnostics",
    text: "Web UI, extension views, debug endpoints, analytics pages, and graph inspection workflows.",
  },
] as const;

function ArchitectureSection() {
  return (
    <section className="ca-section ca-architecture-section">
      <div className="ca-section-inner">
        <div className="ca-section-header">
          <span className="ca-section-tag">Architecture</span>
          <h2 className="ca-section-h2">Structured as a real engineering system</h2>
          <p className="ca-section-desc">
            CodeAtlas is not only a visual page. It is a repository analysis pipeline, graph persistence layer, and exploration interface working together.
          </p>
        </div>

        <div className="ca-arch-grid">
          {ARCH_BLOCKS.map((block) => (
            <div key={block.title} className="ca-arch-card">
              <span className="ca-arch-label">{block.label}</span>
              <h3 className="ca-arch-title">{block.title}</h3>
              <p className="ca-arch-text">{block.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="ca-cta-section">
      <div className="ca-cta-inner">
        <div className="ca-cta-glow" />
        <span className="ca-section-tag">Start exploring</span>
        <h2 className="ca-cta-h2">
          Understand your repository
          <br />
          as a connected system.
        </h2>
        <p className="ca-cta-desc">
          Open a project, build the graph, inspect the structure, and move from file guessing to graph-backed understanding.
        </p>
        <div className="ca-hero-ctas" style={{ justifyContent: "center" }}>
          <Link to="/onboarding" className="ca-btn-main">
            Launch CodeAtlas <span className="ca-arr">→</span>
          </Link>
          <Link to="/graph" className="ca-btn-outline">
            Explore Demo Graph
          </Link>
        </div>
      </div>
    </section>
  );
}

function FullFooter() {
  return (
    <footer className="ca-full-footer">
      <div className="ca-footer-inner">
        <div className="ca-footer-brand">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="ca-logo-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" fill="white" opacity="0.9" />
                <circle cx="2" cy="3" r="1.5" fill="white" opacity="0.5" />
                <circle cx="14" cy="3" r="1.5" fill="white" opacity="0.5" />
                <circle cx="2" cy="13" r="1.5" fill="white" opacity="0.5" />
                <circle cx="14" cy="13" r="1.5" fill="white" opacity="0.5" />
                <line x1="8" y1="5" x2="2" y2="3" stroke="white" strokeOpacity="0.4" strokeWidth="0.8" />
                <line x1="8" y1="5" x2="14" y2="3" stroke="white" strokeOpacity="0.4" strokeWidth="0.8" />
                <line x1="8" y1="11" x2="2" y2="13" stroke="white" strokeOpacity="0.4" strokeWidth="0.8" />
                <line x1="8" y1="11" x2="14" y2="13" stroke="white" strokeOpacity="0.4" strokeWidth="0.8" />
              </svg>
            </div>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 17,
                color: "var(--t0)",
                letterSpacing: "-0.3px",
              }}
            >
              CodeAtlas
            </span>
          </div>

          <p className="ca-footer-tagline">
            Navigate any codebase like a map and understand software structure through a repository knowledge graph.
          </p>
        </div>

        <div className="ca-footer-links">
          <div className="ca-footer-col">
            <div className="ca-footer-col-title">Product</div>
            <Link to="/graph" className="ca-footer-link">
              Graph Viewer
            </Link>
            <Link to="/history" className="ca-footer-link">
              Graph History
            </Link>
            <Link to="/onboarding" className="ca-footer-link">
              Get Started
            </Link>
          </div>

          <div className="ca-footer-col">
            <div className="ca-footer-col-title">Resources</div>
            <Link to="/faquestions" className="ca-footer-link">
              FAQ
            </Link>
            <a
              href="https://github.com/FatmaNageh/CodeAtlas.git"
              className="ca-footer-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/mariam-ashraf-40309b247/"
              className="ca-footer-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>

      <div className="ca-footer-bottom">
        <span>© 2026 CodeAtlas. Graduation Project.</span>
        <div className="ca-socials">
          <a
            href="https://github.com/FatmaNageh/CodeAtlas.git"
            className="ca-social-link"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "14px" }}
          >
            ⚡
          </a>
          <a
            href="https://www.linkedin.com/in/mariam-ashraf-40309b247/"
            className="ca-social-link"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "12px" }}
          >
            in
          </a>
        </div>
      </div>
    </footer>
  );
}

export function CodeAtlasHomePage() {
  return (
    <div style={{ position: "relative", overflowX: "hidden" }}>
      <Stars />
      <Beam />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "calc(100vh - 64px)",
          }}
        >
          <section className="ca-hero" style={{ flex: 1 }}>
            <div className="ca-hero-left">
              <HeroHeadline />
              <p className="ca-hero-sub">
                Navigate any codebase like a map. CodeAtlas builds a semantic knowledge
                graph of your repository so files, declarations, structure, and dependencies
                become instantly explorable.
              </p>
              <HeroCTAs />
            </div>
            <HeroRight />
          </section>

          <div className="ca-scroll-indicator" aria-hidden="true">
            <span>Scroll to explore</span>
            <div className="ca-scroll-btn">↓</div>
          </div>
        </div>

        <StatsBar />
        <FeaturesSection />
        <HowItWorksSection />
        <GraphModelSection />
        <UseCasesSection />
        <ArchitectureSection />
        <CtaSection />
        <FullFooter />
      </div>
    </div>
  );
}