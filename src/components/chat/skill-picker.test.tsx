// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import type { SkillSelection } from "@/lib/skill-selection";
import { SkillPicker, type ChatSkillItem } from "./skill-picker";

const skills: ChatSkillItem[] = Array.from({ length: 4 }, (_, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index + 1}`,
  versionId: `00000000-0000-4000-8000-00000000001${index + 1}`,
  name: `Skill ${index + 1}`,
  description: `Workflow ${index + 1}`,
  slug: `skill-${index + 1}`,
  catalogId: `skill-${index + 1}`,
  category: "research",
  version: "1.0.0",
  enabled: true,
  autoLoad: false,
  dependencies: [],
}));

function Harness() {
  const [selection, setSelection] = useState<SkillSelection>({
    mode: "auto",
    refs: [],
    contextTarget: "recent_messages",
  });
  return (
    <>
      <output data-testid="count">{selection.refs.length}</output>
      <output data-testid="mode">{selection.mode}</output>
      <SkillPicker
        open
        skills={skills}
        selection={selection}
        scope="message"
        availableMcpTemplateIds={[]}
        canSaveBranch
        onOpenChange={() => undefined}
        onSelectionChange={setSelection}
        onScopeChange={() => undefined}
        onSaveBranch={() => undefined}
        onRestoreInherited={() => undefined}
        onRestoreDefault={() => undefined}
      />
    </>
  );
}

afterEach(cleanup);

describe("SkillPicker", () => {
  it("switches to manual mode and enforces the three-Skill client limit", () => {
    render(<Harness />);
    for (const name of ["Skill 1", "Skill 2", "Skill 3", "Skill 4"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
    }
    expect(screen.getByTestId("count")).toHaveTextContent("3");
    expect(screen.getByTestId("mode")).toHaveTextContent("manual");
  });

  it("filters installed workflows by slug and supports keyboard selection", () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("搜索名称、说明或 slug"), {
      target: { value: "skill-3" },
    });
    expect(screen.getByRole("button", { name: /Skill 3/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Skill 1/ })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });
});
