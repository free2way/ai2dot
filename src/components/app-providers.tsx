import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/server/auth/config";
import { LanguageProvider } from "@/lib/language-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const content = <LanguageProvider>{children}</LanguageProvider>;

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
