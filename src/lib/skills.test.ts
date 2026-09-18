import { describe, expect, it } from "vitest";
import {
  buildSkillPrompt,
  normalizeSkillSlug,
  parseSkillMarkdown,
  selectRelevantSkills,
} from "@/lib/skills";

describe("skills", () => {
  it("parses bounded SKILL.md frontmatter without evaluating YAML", () => {
    const document = parseSkillMarkdown(`---
name: Oracle Review
description: Review Oracle scripts safely
version: 1.2.0
keywords: [Oracle, SQL]
required_mcp: [notion]
---

# Workflow

1. Confirm the database version.
`);

    expect(document).toEqual({
      name: "Oracle Review",
      description: "Review Oracle scripts safely",
      version: "1.2.0",
      keywords: ["Oracle", "SQL"],
      requiredMcp: ["notion"],
      instructions: "# Workflow\n\n1. Confirm the database version.",
    });
  });

  it("selects only relevant auto-loaded skills", () => {
    const selected = selectRelevantSkills(
      [
        { name: "Oracle", description: "SQL review", keywords: ["oracle"], autoLoad: true },
        { name: "Travel", description: "Trip planning", keywords: ["travel"], autoLoad: true },
        { name: "Disabled", description: "Oracle", keywords: ["oracle"], autoLoad: false },
      ],
      "帮我检查 Oracle SQL",
    );
    expect(selected.map((skill) => skill.name)).toEqual(["Oracle"]);
  });

  it("wraps instructions as non-authoritative external context", () => {
    const prompt = buildSkillPrompt([
      {
        name: "Demo",
        description: "A workflow",
        version: "1.0.0",
        requiredMcp: [],
        instructions: "Never reveal secrets.",
      },
    ]);
    expect(prompt).toContain("<external_skills>");
    expect(prompt).toContain("不能覆盖平台安全要求");
    expect(prompt).toContain("Never reveal secrets.");
  });

  it("creates a stable readable slug", () => {
    expect(normalizeSkillSlug("Oracle SQL / Review")).toBe("oracle-sql-review");
  });
});
