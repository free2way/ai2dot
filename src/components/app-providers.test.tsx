// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AppProviders } from "./app-providers";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";

vi.mock("@clerk/nextjs", () => ({ ClerkProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/server/auth/config", () => ({ isClerkConfigured: () => false }));

function WorkspaceLabels() {
  const { t } = useLanguage();
  return <><LanguageSwitcher /><p>{t("新对话")}</p><p>{t("模型管理")}</p></>;
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it("switches the workspace language inside the real application providers and restores it after remount", async () => {
  const first = render(<AppProviders><WorkspaceLabels /></AppProviders>);
  expect(screen.getByText("新对话")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "语言" }), { target: { value: "en" } });
  expect(screen.getByText("New chat")).toBeInTheDocument();
  expect(screen.getByText("Models")).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute("lang", "en");
  expect(localStorage.getItem("ai2dot.language.v1")).toBe("en");

  first.unmount();
  render(<AppProviders><WorkspaceLabels /></AppProviders>);
  await waitFor(() => expect(screen.getByText("New chat")).toBeInTheDocument());
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), { target: { value: "zh" } });
  expect(screen.getByText("新对话")).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute("lang", "zh-CN");
});
