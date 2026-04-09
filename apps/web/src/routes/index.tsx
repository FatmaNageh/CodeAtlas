import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BrainCircuit, GitBranch, Network, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const stats = [
  { value: "4,328",  label: "Nodes extracted",     sub: "from demo repo" },
  { value: "18,763", label: "Relationships mapped", sub: "across the graph" },
  { value: "6",      label: "Languages supported",  sub: "and counting" },
  { value: "18ms",   label: "Avg query time",       sub: "path resolution" },
];

const features = [
  {
    title:       "Force-directed graph",
    description: "Live graph exploration for folders, files, functions, and relationships across your entire repository.",
    icon:        Network,
    color:       "var(--purple)",
    bg:          "var(--purple-l)",
    border:      "var(--purple-b)",
    gradient:    "from-[#ede9fe] to-[#f5f3ff]",
    darkGradient:"from-[#1e1143] to-[#2e1065]",
  },
  {
    title:       "Path tracing",
    description: "Follow the shortest dependency path between any two code entities and understand impact instantly.",
    icon:        GitBranch,
    color:       "var(--blue)",
    bg:          "var(--blue-l)",
    border:      "var(--blue-b)",
    gradient:    "from-[#e0f2fe] to-[#f0f9ff]",
    darkGradient:"from-[#072b41] to-[#0c4a6e]",
  },
  {
    title:       "AI with graph context",
    description: "Ask questions grounded in selected graph nodes — no whole-repo prompts, just precise semantic answers.",
    icon:        BrainCircuit,
    color:       "var(--green)",
    bg:          "var(--green-l)",
    border:      "var(--green-b)",
    gradient:    "from-[#d1fae5] to-[#ecfdf5]",
    darkGradient:"from-[#01231a] to-[#022c22]",
  },
];

function LandingPage() {
  return (
    <section className="codeatlas-shell min-h-[calc(100vh-54px)]">
      <div className="mx-auto w-full max-w-[1000px] px-6 py-20 md:px-8">

        {/* ── Badge ── */}
        <div
          className="mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium tracking-wide"
          style={{
            background: "var(--purple-l)",
            border: "1px solid var(--purple-b)",
            color: "var(--purple)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--purple)", boxShadow: "0 0 6px var(--purple)" }}
          />
          Knowledge Graphs · GraphRAG · Multilingual
        </div>

        {/* ── Hero ── */}
        <h1
          className="max-w-[820px] leading-[1.03] tracking-[-3px]"
          style={{
            fontFamily: "var(--font-display, var(--font-sans))",
            fontSize: "clamp(38px, 5.8vw, 68px)",
            fontWeight: 700,
          }}
        >
          Understand any codebase.
          <br />
          <span style={{ color: "var(--t2)" }}>In minutes, not months.</span>
        </h1>

        <p
          className="mt-5 max-w-[580px] leading-[1.75]"
          style={{ fontSize: "15px", color: "var(--t1)" }}
        >
          CodeAtlas builds a semantic knowledge graph from your repository and gives you
          one place to navigate, query, and understand real code structure — without
          losing the backend integration you already built.
        </p>

        {/* ── CTAs ── */}
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            to="/onboarding"
            className="inline-flex h-11 items-center gap-2.5 rounded-[11px] px-6 text-[13.5px] font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)",
              color: "#fff",
              boxShadow: "0 2px 16px color-mix(in srgb, var(--purple) 28%, transparent), 0 1px 3px rgba(0,0,0,0.15)",
            }}
          >
            Open onboarding <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/graph"
            className="inline-flex h-11 items-center gap-2 rounded-[11px] px-6 text-[13.5px] font-medium transition-colors hover:bg-[var(--s1)]"
            style={{ border: "1px solid var(--b2)", color: "var(--t1)" }}
          >
            <Network className="h-4 w-4" style={{ color: "var(--purple)" }} />
            Open graph viewer
          </Link>
        </div>

        {/* ── Stats strip ── */}
        <div
          className="mt-14 grid overflow-hidden rounded-[16px] md:grid-cols-4"
          style={{ border: "1px solid var(--b1)", background: "var(--s0)" }}
        >
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="px-6 py-5"
              style={{
                borderRight: i < stats.length - 1 ? "1px solid var(--b0)" : undefined,
              }}
            >
              <div
                className="leading-none tracking-[-1.5px]"
                style={{
                  fontSize: "30px",
                  fontWeight: 700,
                  fontFamily: "var(--font-display, var(--font-sans))",
                  color: "var(--t0)",
                }}
              >
                {stat.value}
              </div>
              <div className="mt-2" style={{ fontSize: "12px", color: "var(--t2)" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "11px", color: "var(--t3)" }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Feature cards ── */}
        <div
          className="mt-10 grid overflow-hidden rounded-[16px] md:grid-cols-3"
          style={{ border: "1px solid var(--b1)" }}
        >
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group cursor-default px-6 py-6 transition-colors hover:bg-[var(--s1)]"
                style={{
                  background: "var(--s0)",
                  borderRight: i < features.length - 1 ? "1px solid var(--b0)" : undefined,
                }}
              >
                <div
                  className="mb-4 flex h-9 w-9 items-center justify-center rounded-[9px]"
                  style={{ background: f.bg, border: `1px solid ${f.border}` }}
                >
                  <Icon className="h-4.5 w-4.5" style={{ color: f.color, width: 18, height: 18 }} />
                </div>
                <div
                  className="mb-2 leading-snug"
                  style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--t0)" }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: "12px", lineHeight: "1.7", color: "var(--t2)" }}>
                  {f.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Legend / graph preview box ── */}
        <div
          className="mt-10 rounded-[16px] p-6"
          style={{ border: "1px solid var(--b1)", background: "var(--s0)" }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--purple)" }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--t0)" }}>
              Graph node legend
            </span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              { label: "Folder", color: "var(--purple)", bg: "var(--purple-l)" },
              { label: "File",   color: "var(--blue)",   bg: "var(--blue-l)"   },
              { label: "Class",  color: "var(--amber)",  bg: "var(--amber-l)"  },
              { label: "Function", color: "var(--green)", bg: "var(--green-l)" },
            ].map(({ label, color, bg }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div
                  className="h-5 w-5 rounded-full"
                  style={{
                    background: color,
                    boxShadow: `0 0 0 3px ${bg}`,
                  }}
                />
                <span style={{ fontSize: "12px", color: "var(--t1)" }}>{label}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-4" style={{ fontSize: "12px", color: "var(--t3)" }}>
              <span className="flex items-center gap-1.5">
                <span
                  className="block h-px w-6"
                  style={{ background: "var(--purple)", opacity: 0.6 }}
                />
                CONTAINS
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="block h-px w-6"
                  style={{
                    background: "var(--blue)",
                    opacity: 0.6,
                    backgroundImage: "repeating-linear-gradient(90deg, var(--blue) 0 5px, transparent 5px 8px)",
                  }}
                />
                IMPORTS
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="block h-px w-6"
                  style={{
                    background: "var(--green)",
                    opacity: 0.6,
                    backgroundImage: "repeating-linear-gradient(90deg, var(--green) 0 3px, transparent 3px 6px)",
                  }}
                />
                CALLS
              </span>
            </div>
          </div>
        </div>

        {/* ── Status banner ── */}
        <div
          className="mt-8 flex items-start gap-4 rounded-[14px] p-5"
          style={{ border: "1px solid var(--b1)", background: "var(--s0)" }}
        >
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
            style={{ background: "var(--green-l)", border: "1px solid var(--green-b)" }}
          >
            <Zap className="h-4 w-4" style={{ color: "var(--green)" }} />
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--t0)", marginBottom: 4 }}>
              React migration active
            </div>
            <p style={{ fontSize: "12px", lineHeight: "1.75", color: "var(--t1)", maxWidth: 680 }}>
              Code Atlas changes the boring code lines into a real{" "}
              <code
                className="rounded px-1.5 py-0.5"
                style={{
                  background: "var(--s2)",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono, monospace)",
                  color: "var(--purple)",
                }}
              >
                 interactive map
              </code>{" "}
              where users can explore the codebase visually.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
