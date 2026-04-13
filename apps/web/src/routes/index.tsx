import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";

export const Route = createFileRoute("/")({
  component: CodeAtlasHomePage,
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number; r: number;
}
interface GraphNode {
  id: string; x: number; y: number; r: number;
  color: string; label: string; type: string; count?: number;
}
interface TiltState { x: number; y: number }

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCountUp(target: number, duration = 1600, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setCount(Math.floor(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return count;
}

function useTilt(strength = 12) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<TiltState>({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      setTilt({ x: dy * strength, y: -dx * strength });
      setGlowPos({
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      });
    };
    const onLeave = () => { setTilt({ x: 0, y: 0 }); setGlowPos({ x: 50, y: 50 }); };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, [strength]);
  return { ref, tilt, glowPos };
}

// ── Custom Cursor ─────────────────────────────────────────────────────────────
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    let mx = 0, my = 0, rx = 0, ry = 0, raf = 0;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const track = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      if (!visible) setVisible(true);
      const target = e.target as HTMLElement;
      const isHoverable = target.closest("a, button, [data-hover]");
      setHovering(!!isHoverable);
    };
    const onDown = () => setClicking(true);
    const onUp = () => setClicking(false);

    const loop = () => {
      rx = lerp(rx, mx, 0.1); ry = lerp(ry, my, 0.1);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mx - 4}px, ${my - 4}px)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${rx - 20}px, ${ry - 20}px)`;
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", track);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", track);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <div
        ref={dotRef}
        className={`ca-cursor-dot ${clicking ? "ca-cursor-dot--click" : ""} ${hovering ? "ca-cursor-dot--hover" : ""}`}
      />
      <div
        ref={ringRef}
        className={`ca-cursor-ring ${hovering ? "ca-cursor-ring--hover" : ""}`}
      />
    </>
  );
}

// ── Particle Canvas ───────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const mouse = { x: -2000, y: -2000 };

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();

    const N = 70;
    const particles: Particle[] = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 0.8 + Math.random() * 1.8,
    }));

    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        const dx = p.x - mouse.x; const dy = p.y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120 && d > 0) {
          const f = ((120 - d) / 120) * 0.6;
          p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        }
        p.vx *= 0.98; p.vy *= 0.98;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(45,232,200,0.5)";
        ctx.fill();
      }

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(45,232,200,${(1 - d / 130) * 0.12})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="ca-particle-canvas" aria-hidden="true" />;
}

// ── Typing Animation ──────────────────────────────────────────────────────────
const PHRASES = [
  "Navigate any codebase like a map.",
  "Understand structure at a glance.",
  "Trace dependencies visually.",
  "Build graph-backed intelligence.",
];

function TypingText() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = PHRASES[phraseIdx];
    let t: ReturnType<typeof setTimeout>;
    if (!deleting && text.length < phrase.length) {
      t = setTimeout(() => setText(phrase.slice(0, text.length + 1)), 48);
    } else if (!deleting && text.length === phrase.length) {
      t = setTimeout(() => setDeleting(true), 2800);
    } else if (deleting && text.length > 0) {
      t = setTimeout(() => setText(text.slice(0, -1)), 22);
    } else {
      setDeleting(false);
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }
    return () => clearTimeout(t);
  }, [text, deleting, phraseIdx]);

  return (
    <span className="ca-typing-wrap">
      <span className="ca-typing-text">{text}</span>
      <span className="ca-cursor-blink" aria-hidden="true">|</span>
    </span>
  );
}

// ── Hero Headline ─────────────────────────────────────────────────────────────
function HeroHeadline() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const words = ["EXPLORE", "YOUR CODE", "{ATLAS}"];
  return (
    <h1 className="ca-h1" aria-label="Explore Your Code Atlas">
      {words.map((word, wi) => (
        <span key={wi} className="ca-h1-line">
          {word.split("").map((ch, ci) => (
            <span
              key={ci}
              className={`ca-h1-char ${mounted ? "ca-h1-char--in" : ""} ${word.includes("{") && ch !== " " ? "ca-h1-char--accent" : ""}`}
              style={{ transitionDelay: `${wi * 120 + ci * 30}ms` }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

// ── Hero CTAs ─────────────────────────────────────────────────────────────────
function HeroCTAs() {
  const btn1Ref = useRef<HTMLAnchorElement>(null);
  const btn2Ref = useRef<HTMLAnchorElement>(null);

  const makeMagnetic = useCallback((ref: React.RefObject<HTMLAnchorElement | null>) => {
    const el = ref.current; if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) * 0.3;
      const dy = (e.clientY - r.top - r.height / 2) * 0.3;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const onLeave = () => { el.style.transform = ""; };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, []);

  useEffect(() => makeMagnetic(btn1Ref), [makeMagnetic]);
  useEffect(() => makeMagnetic(btn2Ref), [makeMagnetic]);

  return (
    <div className="ca-hero-ctas">
      <Link ref={btn1Ref} to="/onboarding" className="ca-btn-main" data-hover="true">
        <span className="ca-btn-bg" />
        <span className="ca-btn-label">Get Started</span>
        <span className="ca-arr">→</span>
      </Link>
      <Link ref={btn2Ref} to="/graph" className="ca-btn-outline" data-hover="true">
        <span className="ca-btn-label">Open Graph Viewer</span>
      </Link>
    </div>
  );
}

// ── Interactive Knowledge Graph ────────────────────────────────────────────────
const GRAPH_NODES: GraphNode[] = [
  { id: "src", x: 200, y: 160, r: 22, color: "#2de8c8", label: "/src", type: "Directory", count: 48 },
  { id: "routes", x: 95, y: 95, r: 13, color: "#2de8c8", label: "routes/", type: "Directory", count: 12 },
  { id: "lib", x: 95, y: 230, r: 13, color: "#2de8c8", label: "lib/", type: "Directory", count: 8 },
  { id: "services", x: 320, y: 100, r: 15, color: "#a78bfa", label: "services/", type: "Module", count: 6 },
  { id: "auth", x: 430, y: 55, r: 10, color: "#a78bfa", label: "auth.ts", type: "CodeFile" },
  { id: "graph", x: 430, y: 150, r: 10, color: "#a78bfa", label: "graph.ts", type: "CodeFile" },
  { id: "ast", x: 210, y: 310, r: 14, color: "#fbbf24", label: "ast/", type: "Directory" },
  { id: "ir", x: 100, y: 380, r: 9, color: "#fbbf24", label: "ir.ts", type: "CodeFile" },
  { id: "schema", x: 320, y: 380, r: 9, color: "#fbbf24", label: "schema.ts", type: "CodeFile" },
];

const GRAPH_EDGES = [
  { from: "src", to: "routes", label: "CONTAINS" },
  { from: "src", to: "lib", label: "CONTAINS" },
  { from: "src", to: "services", label: "IMPORTS" },
  { from: "services", to: "auth", label: "DECLARES" },
  { from: "services", to: "graph", label: "DECLARES" },
  { from: "ast", to: "ir", label: "DECLARES" },
  { from: "ast", to: "schema", label: "DECLARES" },
  { from: "src", to: "ast", label: "DECLARES", dashed: true },
];

function InteractiveGraph() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pulseMap, setPulseMap] = useState<Record<string, boolean>>({});

  const hovered = hoveredId ? GRAPH_NODES.find((n) => n.id === hoveredId) : null;
  const active = activeId ? GRAPH_NODES.find((n) => n.id === activeId) : null;
  const displayNode = hovered || active;

  const getNodeById = (id: string) => GRAPH_NODES.find((n) => n.id === id);

  const isHighlighted = (nodeId: string) => {
    if (!hoveredId) return true;
    if (nodeId === hoveredId) return true;
    return GRAPH_EDGES.some(
      (e) => (e.from === hoveredId && e.to === nodeId) || (e.to === hoveredId && e.from === nodeId)
    );
  };

  const isEdgeHighlighted = (edge: typeof GRAPH_EDGES[0]) => {
    if (!hoveredId) return true;
    return edge.from === hoveredId || edge.to === hoveredId;
  };

  useEffect(() => {
    const pulse = (id: string) => {
      setPulseMap((m) => ({ ...m, [id]: true }));
      setTimeout(() => setPulseMap((m) => ({ ...m, [id]: false })), 600);
    };
    const interval = setInterval(() => {
      const randomNode = GRAPH_NODES[Math.floor(Math.random() * GRAPH_NODES.length)];
      pulse(randomNode.id);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ca-igraph-wrap">
      <svg
        className="ca-graph-svg"
        viewBox="0 0 520 440"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Interactive CodeAtlas knowledge graph"
      >
        <defs>
          <filter id="glow-teal">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-purple">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-amber">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="arr-teal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="rgba(45,232,200,0.5)" />
          </marker>
          <marker id="arr-purple" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="rgba(167,139,250,0.5)" />
          </marker>
          <marker id="arr-amber" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="rgba(251,191,36,0.5)" />
          </marker>
          <pattern id="ca-grid2" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.6" fill="rgba(148,163,184,0.06)" />
          </pattern>
        </defs>

        <rect width="520" height="440" fill="url(#ca-grid2)" />

        {/* Edges */}
        {GRAPH_EDGES.map((edge, i) => {
          const from = getNodeById(edge.from); const to = getNodeById(edge.to);
          if (!from || !to) return null;
          const highlighted = isEdgeHighlighted(edge);
          const edgeColor = edge.label === "CONTAINS" ? "rgba(45,232,200," :
            edge.label === "IMPORTS" ? "rgba(167,139,250," : "rgba(251,191,36,";
          const marker = edge.label === "CONTAINS" ? "arr-teal" : edge.label === "IMPORTS" ? "arr-purple" : "arr-amber";
          return (
            <line
              key={i}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={`${edgeColor}${highlighted ? "0.45" : "0.1"})`}
              strokeWidth={highlighted ? 1.5 : 0.8}
              strokeDasharray={edge.dashed ? "4 3" : undefined}
              markerEnd={`url(#${marker})`}
              style={{ transition: "all 0.2s ease" }}
            />
          );
        })}

        {/* Edge labels */}
        {hoveredId && GRAPH_EDGES
          .filter((e) => e.from === hoveredId || e.to === hoveredId)
          .map((edge, i) => {
            const from = getNodeById(edge.from); const to = getNodeById(edge.to);
            if (!from || !to) return null;
            const mx = (from.x + to.x) / 2; const my = (from.y + to.y) / 2;
            const color = edge.label === "CONTAINS" ? "#2de8c8" : edge.label === "IMPORTS" ? "#a78bfa" : "#fbbf24";
            return (
              <text key={i} x={mx} y={my - 4} textAnchor="middle"
                fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill={color} opacity="0.8">
                {edge.label}
              </text>
            );
          })}

        {/* Nodes */}
        {GRAPH_NODES.map((node) => {
          const isH = isHighlighted(node.id);
          const isA = activeId === node.id;
          const isPulse = pulseMap[node.id];
          const filterMap: Record<string, string> = {
            "#2de8c8": "url(#glow-teal)",
            "#a78bfa": "url(#glow-purple)",
            "#fbbf24": "url(#glow-amber)",
          };
          return (
            <g
              key={node.id}
              style={{ cursor: "pointer", opacity: isH ? 1 : 0.2, transition: "opacity 0.2s ease" }}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setActiveId(activeId === node.id ? null : node.id)}
            >
              {/* Pulse ring */}
              {(isPulse || isA) && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke={node.color} strokeWidth="1"
                  opacity={isPulse ? 0.5 : 0.3}
                  style={{ animation: isPulse ? "ca-pulse-ring 0.6s ease-out" : undefined }}
                />
              )}
              {/* Outer glow ring */}
              <circle cx={node.x} cy={node.y} r={node.r + 6}
                fill={`${node.color}12`} stroke={`${node.color}30`}
                strokeWidth="1"
                style={{ transition: "r 0.2s ease" }}
              />
              {/* Main circle */}
              <circle
                cx={node.x} cy={node.y} r={node.r}
                fill={`${node.color}18`}
                stroke={node.color}
                strokeWidth={isA ? 2 : 1.5}
                filter={hoveredId === node.id ? filterMap[node.color] : undefined}
              >
                {!hoveredId && <animate attributeName="r" values={`${node.r};${node.r + 1.5};${node.r}`} dur={`${2.5 + Math.random()}s`} repeatCount="indefinite" />}
              </circle>
              {/* Inner dot */}
              <circle cx={node.x} cy={node.y} r={node.r * 0.35} fill={node.color} opacity="0.9" />
              {/* Label */}
              <text
                x={node.x} y={node.y + node.r + 13}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                fill={node.color}
                opacity="0.85"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Node info tooltip */}
      <div className={`ca-node-tooltip ${displayNode ? "ca-node-tooltip--visible" : ""}`}>
        {displayNode && (
          <>
            <div className="ca-node-tooltip-type">{displayNode.type}</div>
            <div className="ca-node-tooltip-name" style={{ color: displayNode.color }}>{displayNode.label}</div>
            {displayNode.count !== undefined && (
              <div className="ca-node-tooltip-count">{displayNode.count} children</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GraphCard() {
  const { ref, tilt, glowPos } = useTilt(8);

  return (
    <div className="ca-hero-right-wrap" ref={ref} style={{
      transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
      transition: "transform 0.1s ease",
    }}>
      <div className="ca-graph-card" style={{
        background: `radial-gradient(ellipse at ${glowPos.x}% ${glowPos.y}%, rgba(45,232,200,0.04) 0%, transparent 60%), var(--s0)`,
      }}>
        <div className="ca-graph-topbar">
          <div className="ca-traffic-lights">
            <div className="ca-tl ca-tl--r" />
            <div className="ca-tl ca-tl--y" />
            <div className="ca-tl ca-tl--g" />
          </div>
          <div className="ca-graph-title">codeatlas-demo · knowledge graph</div>
          <div className="ca-graph-actions">
            {["⟳", "⊕", "⋯"].map((icon) => (
              <button key={icon} className="ca-graph-btn" type="button" data-hover="true">{icon}</button>
            ))}
          </div>
        </div>
        <div className="ca-graph-body">
          <InteractiveGraph />
          <div className="ca-graph-sidebar">
            <div className="ca-sidebar-label">Legend</div>
            {[
              { color: "#2de8c8", label: "Directories", count: 12 },
              { color: "#a78bfa", label: "Code files", count: 48 },
              { color: "#fbbf24", label: "AST / IR", count: 26 },
              { color: "rgba(148,163,184,0.7)", label: "Relations", count: 9 },
            ].map(({ color, label, count }) => (
              <div key={label} className="ca-sidebar-row">
                <span className="ca-sidebar-dot" style={{ background: color }} />
                {label}
                <span className="ca-sidebar-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ca-graph-tag">
        <span className="ca-graph-tag-hint">↑ hover nodes to explore</span>
        <br />
        node: <strong style={{ color: "#2de8c8" }}>UserService</strong>
        <br />
        type: <span style={{ color: "#a78bfa" }}>class</span> · rel:
        <span style={{ color: "#fbbf24" }}> DECLARES</span>
      </div>
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
const STATS = [
  { value: 6, suffix: "", label: "Core node types", icon: "◈" },
  { value: 12, suffix: "+", label: "Supported languages", icon: "⌘" },
  { value: 11, suffix: "", label: "Graph relations", icon: "◎" },
  { value: 1, suffix: "", label: "Canonical schema", icon: "✦" },
] as const;

function StatItem({ value, suffix, label, icon, start }: { value: number; suffix: string; label: string; icon: string; start: boolean }) {
  const count = useCountUp(value, 1800, start);
  return (
    <div className="ca-stat-item" data-hover="true">
      <div className="ca-stat-icon">{icon}</div>
      <div className="ca-stat-value">{count.toLocaleString()}{suffix}</div>
      <div className="ca-stat-label">{label}</div>
      <div className="ca-stat-shine" />
    </div>
  );
}

function StatsBar() {
  const { ref, inView } = useInView(0.2);
  return (
    <section className="ca-stats-section">
      <div ref={ref} className="ca-stats-bar">
        {STATS.map((s, i) => (
          <div key={s.label} className={`ca-reveal ${inView ? "ca-reveal--in" : ""}`} style={{ transitionDelay: `${i * 80}ms` }}>
            <StatItem {...s} start={inView} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "◈", color: "var(--teal)", title: "Repository knowledge graph", desc: "Turn repositories into an explorable graph of files, folders, chunks, AST nodes, and semantic relationships." },
  { icon: "⌘", color: "var(--purple)", title: "Graph-based code exploration", desc: "Trace imports, declarations, extensions, and references visually instead of jumping between disconnected files." },
  { icon: "◎", color: "var(--amber)", title: "Impact & dependency analysis", desc: "Understand what depends on what before changing a file, deleting a function, or refactoring shared logic." },
  { icon: "⊞", color: "var(--blue)", title: "Incremental indexing", desc: "Re-index only what changed and keep the graph aligned with the real repository state." },
  { icon: "✦", color: "var(--green)", title: "Diagnostics & validation", desc: "Inspect graph quality, schema consistency, missing properties, and indexing health through dedicated debug views." },
  { icon: "▣", color: "var(--coral)", title: "Web + VS Code experience", desc: "Explore the same repository understanding workflow through both the web interface and the extension environment." },
] as const;

function FeatureCard({ icon, color, title, desc, delay }: { icon: string; color: string; title: string; desc: string; delay: number }) {
  const cardRef = useRef<HTMLElement>(null);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const { ref: inViewRef, inView } = useInView(0.15);

  useEffect(() => {
    const el = cardRef.current; if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      setGlowPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={inViewRef} className={`ca-reveal ${inView ? "ca-reveal--in" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      <article
        ref={cardRef}
        className="ca-feature-card"
        style={{ "--glow-x": `${glowPos.x}%`, "--glow-y": `${glowPos.y}%`, "--feature-color": color } as React.CSSProperties}
      >
        <div className="ca-feature-card-glow" />
        <div className="ca-feature-icon" style={{ color, borderColor: `color-mix(in srgb, ${color} 25%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
          {icon}
        </div>
        <h3 className="ca-feature-title">{title}</h3>
        <p className="ca-feature-desc">{desc}</p>
      </article>
    </div>
  );
}

function FeaturesSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <section className="ca-section ca-features-section">
      <div className="ca-section-inner">
        <div ref={ref} className={`ca-section-header ca-reveal ${inView ? "ca-reveal--in" : ""}`}>
          <span className="ca-section-tag">Core capabilities</span>
          <h2 className="ca-section-h2">A codebase is more than a file tree</h2>
          <p className="ca-section-desc">CodeAtlas helps developers understand structure, dependencies, declarations, and repository-wide impact from one coherent view.</p>
        </div>
        <div className="ca-features-grid">
          {FEATURES.map(({ icon, color, title, desc }, i) => (
            <FeatureCard key={title} icon={icon} color={color} title={title} desc={desc} delay={i * 60} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────
const STEPS = [
  { num: "01", color: "var(--teal)", title: "Select a repository", desc: "Choose a local project and let CodeAtlas scan the repository structure while respecting ignore rules and stable path handling.", icon: "📂" },
  { num: "02", color: "var(--purple)", title: "Build the graph", desc: "Parse supported files, normalize extracted facts into IR, and persist a clean canonical Neo4j graph with deterministic IDs.", icon: "⚙️" },
  { num: "03", color: "var(--amber)", title: "Explore and analyze", desc: "Navigate the graph, inspect node details, validate indexing output, and answer architecture questions with confidence.", icon: "🔭" },
] as const;

function HowItWorksSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <section className="ca-section ca-how-section">
      <div className="ca-section-inner">
        <div ref={ref} className={`ca-section-header ca-reveal ${inView ? "ca-reveal--in" : ""}`}>
          <span className="ca-section-tag">How it works</span>
          <h2 className="ca-section-h2">From raw repository to understandable system</h2>
        </div>
        <div className="ca-steps">
          {STEPS.map(({ num, color, title, desc }, i) => {
            const { ref: sRef, inView: sIn } = useInView(0.15);
            return (
              <div key={num} ref={sRef} className={`ca-step ca-reveal ${sIn ? "ca-reveal--in" : ""}`}
                style={{ transitionDelay: `${i * 100}ms`, "--step-color": color } as React.CSSProperties}>
                <div className="ca-step-connector" />
                <div className="ca-step-num" style={{ color, borderColor: `color-mix(in srgb, ${color} 30%, transparent)`, background: `color-mix(in srgb, ${color} 6%, transparent)` }}>{num}</div>
                <h3 className="ca-step-title">{title}</h3>
                <p className="ca-step-desc">{desc}</p>
                <div className="ca-step-glow" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${color} 8%, transparent), transparent 70%)` }} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Graph Model ───────────────────────────────────────────────────────────────
const ENTITY_CARDS = [
  { title: "Node types", tag: "nodes", items: ["Repo", "Directory", "CodeFile", "TextFile", "TextChunk", "AstNode"] },
  { title: "Core relations", tag: "core", items: ["CONTAINS", "HAS_CHUNK", "NEXT_CHUNK", "DECLARES", "HAS_AST_ROOT", "AST_CHILD"] },
  { title: "Semantic relations", tag: "semantic", items: ["IMPORTS", "EXTENDS", "OVERRIDES", "DESCRIBES", "MENTIONS", "REFERENCES"] },
] as const;

function GraphModelSection() {
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const { ref, inView } = useInView(0.1);
  return (
    <section className="ca-section ca-graphmodel-section">
      <div className="ca-section-inner">
        <div ref={ref} className={`ca-section-header ca-reveal ${inView ? "ca-reveal--in" : ""}`}>
          <span className="ca-section-tag">Graph model</span>
          <h2 className="ca-section-h2">Designed around a clean canonical schema</h2>
          <p className="ca-section-desc">CodeAtlas keeps one consistent graph model so indexing, querying, debugging, and visualization all speak the same language.</p>
        </div>
        <div className="ca-model-grid">
          {ENTITY_CARDS.map((card, ci) => {
            const { ref: cRef, inView: cIn } = useInView(0.15);
            return (
              <div key={card.title} ref={cRef} className={`ca-model-card ca-reveal ${cIn ? "ca-reveal--in" : ""}`}
                style={{ transitionDelay: `${ci * 80}ms` }}>
                <h3 className="ca-model-title">{card.title}</h3>
                <div className="ca-chip-wrap">
                  {card.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`ca-chip ${activeChip === item ? "ca-chip--active" : ""}`}
                      onClick={() => setActiveChip(activeChip === item ? null : item)}
                      data-hover="true"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {activeChip && (
          <div className="ca-chip-detail">
            <span className="ca-chip-detail-name">{activeChip}</span>
            <span className="ca-chip-detail-badge">selected</span>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Use Cases ─────────────────────────────────────────────────────────────────
const USE_CASES = [
  { title: "Onboarding faster", desc: "New developers can see how folders, files, and declarations connect instead of reverse-engineering the repo manually.", icon: "🚀" },
  { title: "Safer refactoring", desc: "Trace what imports, extends, overrides, or references a component before editing it.", icon: "🔧" },
  { title: "Architecture understanding", desc: "Inspect how services, routes, models, and utility layers are actually connected in the codebase.", icon: "🗺️" },
  { title: "Validation and debugging", desc: "Use diagnostics pages and graph-level checks to catch schema mismatches, missing nodes, and indexing inconsistencies.", icon: "🔍" },
] as const;

function UseCasesSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <section className="ca-section ca-usecases-section">
      <div className="ca-section-inner">
        <div ref={ref} className={`ca-section-header ca-reveal ${inView ? "ca-reveal--in" : ""}`}>
          <span className="ca-section-tag">Why it matters</span>
          <h2 className="ca-section-h2">Built for real repository understanding tasks</h2>
        </div>
        <div className="ca-usecase-grid">
          {USE_CASES.map(({ title, desc, icon }, i) => {
            const { ref: uRef, inView: uIn } = useInView(0.15);
            return (
              <div key={title} ref={uRef} className={`ca-usecase-card ca-reveal ${uIn ? "ca-reveal--in" : ""}`}
                style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="ca-usecase-icon">{icon}</span>
                <h3 className="ca-usecase-title">{title}</h3>
                <p className="ca-usecase-desc">{desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Architecture ──────────────────────────────────────────────────────────────
const ARCH_BLOCKS = [
  { label: "Input", title: "Repository scan", text: "Project selection, ignore rules, classification, deterministic traversal, and stable relative paths.", color: "var(--teal)" },
  { label: "Processing", title: "Parsing + IR normalization", text: "Language-aware extraction feeds a strict intermediate representation before anything reaches the graph.", color: "var(--purple)" },
  { label: "Persistence", title: "Neo4j graph storage", text: "Canonical node labels, fixed relationship vocabulary, deterministic IDs, and schema constraints.", color: "var(--amber)" },
  { label: "Product", title: "Exploration + diagnostics", text: "Web UI, extension views, debug endpoints, analytics pages, and graph inspection workflows.", color: "var(--coral)" },
] as const;

function ArchitectureSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <section className="ca-section ca-architecture-section">
      <div className="ca-section-inner">
        <div ref={ref} className={`ca-section-header ca-reveal ${inView ? "ca-reveal--in" : ""}`}>
          <span className="ca-section-tag">Architecture</span>
          <h2 className="ca-section-h2">Structured as a real engineering system</h2>
          <p className="ca-section-desc">CodeAtlas is a repository analysis pipeline, graph persistence layer, and exploration interface working together.</p>
        </div>
        <div className="ca-arch-pipeline">
          {ARCH_BLOCKS.map((block, i) => {
            const { ref: aRef, inView: aIn } = useInView(0.15);
            return (
              <div key={block.title} ref={aRef}
                className={`ca-arch-step ca-reveal ${aIn ? "ca-reveal--in" : ""}`}
                style={{ transitionDelay: `${i * 90}ms`, "--arch-color": block.color } as React.CSSProperties}>
                <div className="ca-arch-step-line" />
                <div className="ca-arch-num" style={{ color: block.color, borderColor: `color-mix(in srgb, ${block.color} 35%, transparent)`, background: `color-mix(in srgb, ${block.color} 7%, transparent)` }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <span className="ca-arch-label" style={{ color: block.color }}>{block.label}</span>
                <h3 className="ca-arch-title">{block.title}</h3>
                <p className="ca-arch-text">{block.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── CTA Section ───────────────────────────────────────────────────────────────
function CtaSection() {
  const { ref, inView } = useInView(0.2);
  return (
    <section className="ca-cta-section">
      <div ref={ref} className={`ca-cta-inner ca-reveal ${inView ? "ca-reveal--in" : ""}`}>
        <div className="ca-cta-glow" />
        <div className="ca-cta-grid-bg" />
        <span className="ca-section-tag" style={{ marginBottom: 20 }}>Start exploring</span>
        <h2 className="ca-cta-h2">
          Understand your repository<br />
          <span className="ca-cta-accent">as a connected system.</span>
        </h2>
        <p className="ca-cta-desc">Open a project, build the graph, inspect the structure, and move from file guessing to graph-backed understanding.</p>
        <div className="ca-hero-ctas" style={{ justifyContent: "center" }}>
          <Link to="/onboarding" className="ca-btn-main" data-hover="true">
            <span className="ca-btn-bg" />
            <span className="ca-btn-label">Launch CodeAtlas</span>
            <span className="ca-arr">→</span>
          </Link>
          <Link to="/graph" className="ca-btn-outline" data-hover="true">
            <span className="ca-btn-label">Explore Demo Graph</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
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
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--t0)", letterSpacing: "-0.3px" }}>
              CodeAtlas
            </span>
          </div>
          <p className="ca-footer-tagline">Navigate any codebase like a map and understand software structure through a repository knowledge graph.</p>
        </div>
        <div className="ca-footer-links">
          <div className="ca-footer-col">
            <div className="ca-footer-col-title">Product</div>
            {[{ to: "/graph", label: "Graph Viewer" }, { to: "/indexing", label: "Indexing" }, { to: "/analytics", label: "Analytics" }, { to: "/onboarding", label: "Get Started" }].map(({ to, label }) => (
              <Link key={label} to={to} className="ca-footer-link" data-hover="true">{label}</Link>
            ))}
          </div>
          <div className="ca-footer-col">
            <div className="ca-footer-col-title">Resources</div>
            <Link to="/faquestions" className="ca-footer-link" data-hover="true">FAQ</Link>
            <a href="https://github.com/FatmaNageh/CodeAtlas.git" className="ca-footer-link" target="_blank" rel="noopener noreferrer" data-hover="true">GitHub</a>
            <a href="https://www.linkedin.com/in/mariam-ashraf-40309b247/" className="ca-footer-link" target="_blank" rel="noopener noreferrer" data-hover="true">LinkedIn</a>
          </div>
        </div>
      </div>
      <div className="ca-footer-bottom">
        <span>© 2026 CodeAtlas. Graduation Project.</span>
        <div className="ca-socials">
          <a href="https://github.com/FatmaNageh/CodeAtlas.git" className="ca-social-link" target="_blank" rel="noopener noreferrer" data-hover="true" style={{ fontSize: "14px" }}>⚡</a>
          <a href="https://www.linkedin.com/in/mariam-ashraf-40309b247/" className="ca-social-link" target="_blank" rel="noopener noreferrer" data-hover="true" style={{ fontSize: "12px" }}>in</a>
        </div>
      </div>
    </footer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function CodeAtlasHomePage() {
  return (
    <div className="ca-home" style={{ position: "relative", overflowX: "hidden" }}>
      <CustomCursor />
      <ParticleCanvas />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Hero */}
        <section className="ca-hero">
          <div className="ca-hero-bg-glow" />
          <div className="ca-hero-left">
            <div className="ca-hero-tag">
              <span className="ca-hero-tag-dot" />
              Graph-powered code intelligence
            </div>
            <HeroHeadline />
            <p className="ca-hero-sub">
              <TypingText />
            </p>
            <HeroCTAs />
            <div className="ca-hero-meta">
              <span className="ca-hero-meta-item">✓ Neo4j powered</span>
              <span className="ca-hero-meta-sep" />
              <span className="ca-hero-meta-item">✓ Multi-language</span>
              <span className="ca-hero-meta-sep" />
              <span className="ca-hero-meta-item">✓ VSCode extension</span>
            </div>
          </div>
          <GraphCard />
        </section>

        {/* Scroll hint */}
        <div className="ca-scroll-indicator" aria-hidden="true">
          <span>Scroll to explore</span>
          <div className="ca-scroll-btn">↓</div>
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