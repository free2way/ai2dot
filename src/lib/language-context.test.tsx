// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AppProviders } from "@/components/app-providers";
import { LanguageSwitcher, useLanguage } from "./i18n";
import { useLanguage as useLegacyLanguage } from "./language-context";

vi.mock("@clerk/nextjs", () => ({ ClerkProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/server/auth/config", () => ({ isClerkConfigured: () => false }));

function LanguageConsumers() {
  const workspace = useLanguage();
  const marketing = useLegacyLanguage();
  return <>
    <LanguageSwitcher />
    <p data-testid="workspace-label">{workspace.t("对话")}</p>
    <button onClick={() => marketing.setLanguage("zh")}>{marketing.t("切换为中文", "Switch to Chinese")}</button>
  </>;
}

beforeEach(() => { localStorage.clear(); localStorage.setItem("ai2dot.language.v1", "zh"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("shared application language", () => {
  it("shares language changes between marketing and workspace consumers through the app provider", async () => {
    render(<AppProviders><LanguageConsumers /></AppProviders>);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "en" } });
    expect(screen.getByTestId("workspace-label")).toHaveTextContent("Chat");
    expect(screen.getByRole("button", { name: "Switch to Chinese" })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect(localStorage.getItem("ai2dot.language.v1")).toBe("en");
    fireEvent.click(screen.getByRole("button", { name: "Switch to Chinese" }));
    expect(screen.getByTestId("workspace-label")).toHaveTextContent("对话");
    expect(screen.getByRole("combobox")).toHaveValue("zh");
  });

  it("restores the legacy marketing preference when no shared preference exists", async () => {
    localStorage.removeItem("ai2dot.language.v1");
    localStorage.setItem("ai2dot_lang", "en");
    render(<AppProviders><LanguageConsumers /></AppProviders>);
    await waitFor(() => expect(screen.getByTestId("workspace-label")).toHaveTextContent("Chat"));
  });

  it("still changes language when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage blocked"); });
    render(<AppProviders><LanguageConsumers /></AppProviders>);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "en" } });
    expect(screen.getByTestId("workspace-label")).toHaveTextContent("Chat");
  });
});
