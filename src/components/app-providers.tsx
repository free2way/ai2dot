import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/server/auth/config";
import { LanguageProvider } from "@/lib/i18n";

export function AppProviders({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) {
    return <LanguageProvider>{children}</LanguageProvider>;
  }

  return (
    <LanguageProvider>
      <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
        {children}
      </ClerkProvider>
    </LanguageProvider>
  );
}
