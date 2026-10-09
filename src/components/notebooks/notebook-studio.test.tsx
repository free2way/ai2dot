// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotebookStudio } from "./notebook-studio";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const googleStatus = {
  enabled: false,
  configured: false,
  deploymentRegion: "cn-mainland",
  dataLocation: "global",
  projectConfigured: false,
  credentialsConfigured: false,
  regionSupported: true,
  mainlandChinaDeployment: true,
  network: "not_checked" as const,
  authorization: "not_checked" as const,
  checkedAt: null,
  message: "Google Provider 已关闭，本地研究空间不受影响。",
};

describe("NotebookStudio", () => {
  it("keeps the native notebook creation flow available without Google", () => {
    render(
      <NotebookStudio
        googleStatus={googleStatus}
        initialNotebooks={[]}
        models={[]}
      />,
    );

    expect(screen.getByText("创建第一个研究空间")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "新建研究空间" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("例如：Notebook Studio 产品研究")).toHaveFocus();
    expect(screen.getByRole("button", { name: "创建研究空间" })).toBeEnabled();
  });

  it("opens the video source import flow for an existing notebook", async () => {
    const notebook = {
      id: "notebook-1",
      knowledgeBaseId: "base-1",
      title: "视频学习",
      description: "",
      status: "active" as const,
      documentCount: 0,
      chunkCount: 0,
      semanticChunkCount: 0,
      artifactCount: 0,
      updatedAt: new Date().toISOString(),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          notebook: { ...notebook, documents: [], artifacts: [], videoSources: [] },
        }),
      }),
    );

    render(
      <NotebookStudio
        googleStatus={googleStatus}
        initialNotebooks={[notebook]}
        models={[]}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "视频链接" }));
    expect(screen.getByRole("heading", { name: "添加视频来源" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://www.youtube.com/watch?v=...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存视频来源" })).toBeDisabled();
  });
});
