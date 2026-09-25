// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FEATURED_MODELS } from "@/lib/models";
import { AssistantManager } from "./assistant-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

describe("AssistantManager", () => {
  it("shows a clear empty state and opens a useful template on request", () => {
    render(
      <AssistantManager
        initialAssistants={[]}
        knowledgeBases={[]}
        models={FEATURED_MODELS}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "还没有助手" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("系统提示词")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "创建第一个助手" }));

    expect(
      screen.getByRole("heading", { name: "Oracle 专家" }),
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText("系统提示词") as HTMLTextAreaElement).value,
    ).toContain("Oracle 数据库工程师");
    expect(screen.getByLabelText("名称")).toHaveFocus();
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "开始对话" })).toBeEnabled();
  });

  it("returns to the empty state when creation is cancelled", () => {
    render(
      <AssistantManager
        initialAssistants={[]}
        knowledgeBases={[]}
        models={FEATURED_MODELS}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "创建第一个助手" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(
      screen.getByRole("heading", { name: "还没有助手" }),
    ).toBeInTheDocument();
  });
});
