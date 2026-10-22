import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/server/auth/config";
import { LanguageProvider } from "@/lib/language-context";
import { LanguageProvider as WorkspaceLanguageProvider } from "@/lib/i18n";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const content = (
    <LanguageProvider>
      <WorkspaceLanguageProvider>{children}</WorkspaceLanguageProvider>
    </LanguageProvider>
  );

  if (!isClerkConfigured()) {
    return content;
  }

  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/workspace"
      signInUrl="/sign-in"
      signUpFallbackRedirectUrl="/workspace"
      signUpUrl="/sign-up"
    >
      {content}
    </ClerkProvider>
  );
}
