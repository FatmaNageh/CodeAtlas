import type { PromptTemplate } from "@arizeai/phoenix-evals";

export const ANSWER_RELEVANCE_PROMPT: PromptTemplate = [
  {
    role: "user",
    content: `
You are evaluating whether an answer addresses a specific question.

<rubric>

RELEVANT - The answer:
- Directly addresses the question
- Covers the key intent of the question
- Is on-topic and responsive

UNRELATED - The answer:
- Does not answer the question
- Is off-topic or evasive
- Omits the core intent

</rubric>

<data>

<question>
{{input}}
</question>

<answer>
{{output}}
</answer>

</data>

Is the answer relevant or unrelated to the question?
`,
  },
];

export const REFERENCE_CORRECTNESS_PROMPT: PromptTemplate = [
  {
    role: "user",
    content: `
You are evaluating whether an answer matches the expected reference.

<rubric>

CORRECT - The answer:
- Matches the expected answer or expected facts
- Is consistent with the reference
- Does not contradict the reference

INCORRECT - The answer:
- Contradicts the reference
- Misses key expected facts
- Provides incorrect or unsupported claims relative to the reference

</rubric>

<data>

<question>
{{input}}
</question>

<reference>
{{reference}}
</reference>

<answer>
{{output}}
</answer>

</data>

Is the answer correct or incorrect relative to the reference?
`,
  },
];
