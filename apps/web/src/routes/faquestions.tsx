import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/faquestions")({
  component: FAQPage,
});

type FAQItem = {
  question: string;
  answer: string | string[];
};

type FAQSection = {
  id: string;
  label: string;
  title: string;
  description: string;
  items: FAQItem[];
};

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: "general",
    label: "General",
    title: "About CodeAtlas",
    description:
      "Learn what CodeAtlas is, who it helps, and why it makes repository understanding easier.",
    items: [
      {
        question: "What is CodeAtlas?",
        answer:
          "CodeAtlas is a repository understanding platform that transforms source code and documentation into a navigable knowledge graph. It helps developers explore structure, inspect dependencies, and understand how parts of a codebase connect.",
      },
      {
        question: "Who is CodeAtlas for?",
        answer:
          "CodeAtlas is designed for developers, student teams, software engineers, maintainers, and reviewers who need a clearer view of large or unfamiliar repositories.",
      },
      {
        question: "What problem does CodeAtlas solve?",
        answer:
          "Large repositories are difficult to understand through file trees and isolated code browsing alone. CodeAtlas creates a higher-level map so users can move from raw files to relationships, architecture, and impact paths more quickly.",
      },
      {
        question: "How is CodeAtlas different from a normal code viewer?",
        answer:
          "A normal code viewer shows files one by one. CodeAtlas adds structure, semantic relationships, graph exploration, and cross-file understanding so the repository can be analyzed as a connected system.",
      },
    ],
  },
  {
    id: "graph",
    label: "Knowledge Graph",
    title: "Repository as a graph",
    description:
      "Understand how CodeAtlas models repository structure, code entities, and relationships.",
    items: [
      {
        question: "What does CodeAtlas store in the knowledge graph?",
        answer: [
          "Repository structure such as repository, directories, code files, and text files.",
          "Text chunks extracted from documentation and supported text-based files.",
          "AST-derived entities and their structural relationships.",
          "Cross-file relations such as imports, declarations, inheritance, and references when supported.",
        ],
      },
      {
        question: "What are the main node types in CodeAtlas?",
        answer:
          "The main node types are Repo, Directory, CodeFile, TextFile, TextChunk, and AstNode.",
      },
      {
        question: "What relationships can users explore?",
        answer:
          "Users can explore relationships such as CONTAINS, HAS_CHUNK, NEXT_CHUNK, DECLARES, HAS_AST_ROOT, AST_CHILD, IMPORTS, EXTENDS, OVERRIDES, DESCRIBES, MENTIONS, and REFERENCES.",
      },
      {
        question: "Why use a graph model?",
        answer:
          "Graph models are better for traversing connected information such as dependencies, inheritance chains, AST structure, and cross-file references.",
      },
    ],
  },
  {
    id: "indexing",
    label: "Indexing",
    title: "Building the graph",
    description:
      "See what happens after a repository is selected, from scanning to graph construction.",
    items: [
      {
        question: "How does CodeAtlas process a repository?",
        answer: [
          "It scans the repository and classifies supported files.",
          "It parses source code using language-aware analysis.",
          "It normalizes extracted facts into an internal representation.",
          "It builds graph nodes and relationships, then stores them in Neo4j.",
        ],
      },
      {
        question: "Does CodeAtlas support incremental updates?",
        answer:
          "Yes. CodeAtlas is designed to update the graph when repository content changes, without rebuilding everything from scratch each time.",
      },
      {
        question: "Can CodeAtlas ignore unwanted files or folders?",
        answer:
          "Yes. It can be configured to skip unsupported, irrelevant, or intentionally ignored paths.",
      },
      {
        question: "What happens if a file cannot be parsed?",
        answer:
          "The system should handle the failure safely, preserve indexing stability, and continue processing the rest of the repository whenever possible.",
      },
    ],
  },
  {
    id: "exploration",
    label: "Exploration",
    title: "Using the graph",
    description:
      "Explore how CodeAtlas supports inspection, discovery, and repository reasoning.",
    items: [
      {
        question: "What can users do after the graph is built?",
        answer: [
          "Browse the graph visually.",
          "Inspect node details and metadata.",
          "Trace structural and semantic relationships.",
          "Support onboarding, debugging, maintenance, and architecture understanding.",
        ],
      },
      {
        question: "Can CodeAtlas help with onboarding?",
        answer:
          "Yes. It helps users understand unfamiliar repositories faster by exposing important files, entities, and relationships in a connected visual form.",
      },
      {
        question: "Can CodeAtlas support debugging and impact analysis?",
        answer:
          "Yes. Because relationships are explicit, users can trace where components are defined, how they connect, and what may be affected by a change.",
      },
      {
        question: "Does graph exploration work without AI?",
        answer:
          "Yes. Graph exploration remains useful on its own. AI-assisted features are an enhancement, not a requirement.",
      },
    ],
  },
  {
    id: "ai",
    label: "AI Features",
    title: "AI-assisted understanding",
    description:
      "See how CodeAtlas uses graph-grounded context to support smarter repository understanding.",
    items: [
      {
        question: "Does CodeAtlas include AI-assisted functionality?",
        answer:
          "Yes. CodeAtlas is designed to support graph-grounded AI interactions such as repository question answering, summaries, and guided explanations.",
      },
      {
        question: "How does CodeAtlas reduce hallucination risk?",
        answer:
          "It retrieves targeted graph context and relevant repository elements before generating responses, keeping answers more grounded in actual repository data.",
      },
      {
        question: "What AI-supported tasks can CodeAtlas enable?",
        answer: [
          "Repository question answering.",
          "Summarization of files, modules, or graph regions.",
          "Guided walkthroughs.",
          "Context-aware explanations grounded in repository structure.",
        ],
      },
      {
        question: "Is AI required to benefit from CodeAtlas?",
        answer:
          "No. The core value comes from repository analysis and graph exploration first. AI extends that value by making the graph easier to query and explain.",
      },
    ],
  },
];

function FAQPage() {
  const [activeSection, setActiveSection] = useState(FAQ_SECTIONS[0].id);
  const [openItems, setOpenItems] = useState<Record<string, number>>({
    general: 0,
  });

  const currentSection = useMemo(
    () => FAQ_SECTIONS.find((section) => section.id === activeSection) ?? FAQ_SECTIONS[0],
    [activeSection],
  );

  const toggleItem = (sectionId: string, itemIndex: number) => {
    setOpenItems((prev) => ({
      ...prev,
      [sectionId]: prev[sectionId] === itemIndex ? -1 : itemIndex,
    }));
  };

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top, color-mix(in srgb, var(--purple) 8%, transparent) 0%, transparent 34%), var(--bg)",
      }}
    >
      <section className="mx-auto max-w-7xl px-6 py-10 md:px-8 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div
              className="rounded-3xl p-4"
              style={{
                background: "color-mix(in srgb, var(--s0) 94%, transparent)",
                border: "1px solid var(--b1)",
              }}
            >
              <p
                className="mb-4 px-2 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--t2)" }}
              >
                FAQ Sections
              </p>

              <div className="space-y-2">
                {FAQ_SECTIONS.map((section) => {
                  const isActive = section.id === activeSection;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className="w-full rounded-2xl px-4 py-3 text-left transition"
                      style={{
                        background: isActive
                          ? "color-mix(in srgb, var(--purple) 10%, var(--s0))"
                          : "transparent",
                        border: `1px solid ${
                          isActive
                            ? "color-mix(in srgb, var(--purple) 24%, transparent)"
                            : "transparent"
                        }`,
                        color: isActive ? "var(--t0)" : "var(--t1)",
                      }}
                    >
                      <div className="text-sm font-medium">{section.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div>
            <div className="max-w-3xl">
            

              <h1
                className="mt-4 text-4xl font-semibold tracking-[-0.04em] md:text-6xl"
                style={{ color: "var(--t0)" }}
              >
                CodeAtlas FAQ
              </h1>

              <p
                className="mt-4 max-w-2xl text-base leading-7 md:text-lg"
                style={{ color: "var(--t1)" }}
              >
                Find quick answers about repository analysis, graph construction,
                exploration, and AI-assisted understanding in CodeAtlas.
              </p>
            </div>

            <div
              className="mt-8 rounded-[28px] p-6 md:p-8"
              style={{
                background: "color-mix(in srgb, var(--s0) 96%, transparent)",
                border: "1px solid var(--b1)",
              }}
            >
              <div className="mb-8">
                <h2
                  className="text-2xl font-semibold tracking-[-0.03em] md:text-4xl"
                  style={{ color: "var(--t0)" }}
                >
                  {currentSection.title}
                </h2>

                <p
                  className="mt-3 max-w-2xl text-sm leading-6 md:text-base"
                  style={{ color: "var(--t1)" }}
                >
                  {currentSection.description}
                </p>
              </div>

              <div className="space-y-4">
                {currentSection.items.map((item, index) => {
                  const isOpen = openItems[currentSection.id] === index;

                  return (
                    <div
                      key={item.question}
                      className="overflow-hidden rounded-2xl"
                      style={{
                        background: "color-mix(in srgb, var(--s1) 45%, transparent)",
                        border: "1px solid var(--b1)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(currentSection.id, index)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                      >
                        <span
                          className="text-base font-medium leading-7 md:text-lg"
                          style={{ color: "var(--t0)" }}
                        >
                          {item.question}
                        </span>

                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
                          style={{
                            color: isOpen ? "white" : "var(--t0)",
                            background: isOpen
                              ? "var(--purple)"
                              : "color-mix(in srgb, var(--s0) 100%, transparent)",
                            border: "1px solid var(--b1)",
                          }}
                        >
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5">
                          {Array.isArray(item.answer) ? (
                            <ul
                              className="space-y-2 pl-5 text-sm leading-7 md:text-base"
                              style={{ color: "var(--t1)" }}
                            >
                              {item.answer.map((point) => (
                                <li key={point}>{point}</li>
                              ))}
                            </ul>
                          ) : (
                            <p
                              className="text-sm leading-7 md:text-base"
                              style={{ color: "var(--t1)" }}
                            >
                              {item.answer}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}