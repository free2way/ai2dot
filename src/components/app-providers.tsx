import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/server/auth/config";
import { FeedbackProvider } from "@/lib/feedback";
import { LanguageProvider as WorkspaceLanguageProvider } from "@/lib/i18n";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const content = (
    <WorkspaceLanguageProvider>
      <FeedbackProvider>{children}</FeedbackProvider>
    </WorkspaceLanguageProvider>
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
