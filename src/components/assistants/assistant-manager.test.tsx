// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { FEATURED_MODELS } from "@/lib/models";
import { AssistantManager } from "./assistant-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AssistantManager", () => {
  it("opens with a useful Oracle assistant template", () => {
    render(
      <AssistantManager
        initialAssistants={[]}
        knowledgeBases={[]}
        models={FEATURED_MODELS}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Oracle 专家" }),
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText("系统提示词") as HTMLTextAreaElement).value,
    ).toContain("Oracle 数据库工程师");
    expect(screen.getByRole("button", { name: "开始对话" })).toBeEnabled();
  });
});
