import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BrainCircuit, GitBranch, Network, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const stats = [
  { value: "4,328", label: "Nodes extracted from demo repo" },
  { value: "18,763", label: "Relationships mapped" },
  { value: "6", label: "Languages supported" },
  { value: "18ms", label: "Avg. path query time" },
];

const features = [
  {
    title: "Force-directed graph",
    description:
      "Live graph exploration for folders, files, functions, and relationships across the repository.",
    icon: Network,
    tint: "var(--purple-l)",
    color: "var(--purple)",
  },
  {
    title: "Path tracing",
    description:
      "Follow shortest dependency paths between two code entities to understand impact quickly.",
    icon: GitBranch,
    tint: "var(--blue-l)",
    color: "var(--blue)",
  },
  {
    title: "AI with graph context",
    description:
      "Ask questions grounded in selected graph nodes instead of sending the whole repository.",
    icon: BrainCircuit,
    tint: "var(--green-l)",
    color: "var(--green)",
  },
];

function LandingPage() {
  return (
    <section className="codeatlas-shell min-h-[calc(100vh-50px)]">
      <div className="mx-auto w-full max-w-[980px] px-6 py-18 md:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]" style={{ background: "var(--purple-l)", borderColor: "var(--purple-b)", color: "var(--purple)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--purple)" }} />
          Knowledge graphs · GraphRAG · Multilingual
        </div>

        <h1 className="max-w-[760px] text-[clamp(36px,5.5vw,62px)] font-normal leading-[1.04] tracking-[-2.5px]">
          Understand any codebase.
          <br />
          <span className="text-[var(--t2)]">In minutes, not months.</span>
        </h1>

        <p className="mt-5 max-w-[560px] text-[15px] leading-8 text-[var(--t1)]">
          CodeAtlas builds a semantic knowledge graph from your repository and gives you one place to navigate,
          query, and understand real code structure without losing the backend integration you already built.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/onboarding"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--t0)] px-5 text-[13px] text-[var(--s0)]"
          >
            Open onboarding <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/graph"
            className="inline-flex h-10 items-center rounded-[10px] border border-[var(--b2)] px-5 text-[13px] text-[var(--t1)] hover:bg-[var(--s1)]"
          >
            Open graph viewer
          </Link>
        </div>

        <div className="mt-14 grid overflow-hidden rounded-[14px] border border-[var(--b1)] md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="border-b border-[var(--b0)] bg-[var(--s0)] px-5 py-5 last:border-b-0 md:border-b-0 md:border-r last:md:border-r-0">
              <div className="text-[28px] font-medium tracking-[-1.2px]">{stat.value}</div>
              <div className="mt-1 text-[11px] text-[var(--t2)]">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid overflow-hidden rounded-[14px] border border-[var(--b1)] md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="border-b border-[var(--b0)] bg-[var(--s0)] px-6 py-6 last:border-b-0 md:border-b-0 md:border-r last:md:border-r-0 hover:bg-[var(--s1)]">
                <div className="mb-4 flex h-[30px] w-[30px] items-center justify-center rounded-[6px]" style={{ background: feature.tint, color: feature.color }}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mb-2 text-[13px] font-medium">{feature.title}</div>
                <div className="text-[11px] leading-6 text-[var(--t2)]">{feature.description}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-[16px] border border-[var(--b1)] bg-[var(--s0)] p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] text-[var(--t2)]">
            <Sparkles className="h-3.5 w-3.5" />
            React migration status
          </div>
          <p className="max-w-[720px] text-[13px] leading-7 text-[var(--t1)]">
            This version moves the uploaded HTML concept into the real <code className="rounded bg-[var(--s2)] px-1 py-0.5 text-[12px]">apps/web</code>
            {' '}frontend using routed React pages, shared layout, and reusable onboarding components while keeping the existing graph,
            analytics, and indexing routes available.
          </p>
        </div>
      </div>
    </section>
  );
}
