import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  generateAuthenticatedAppPageMetadata,
  renderAuthenticatedAppPage,
} from "@/core/routes/authenticated-app-route";
import { CoreAppPageShell } from "@/core/pages/core-app-page-shell";
import { isAdminEmail } from "@/lib/admin";
import { AdminAiProviderProfilesCard } from "@/modules/admin/components/admin-ai-provider-profiles-card";

type PageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return generateAuthenticatedAppPageMetadata({
    params,
    canonicalPath: (locale) => `/${locale}/admin/ai-providers`,
    resolveMetadata() {
      return {
        title: "AI provider profiles",
        description: "Manage OpenAI-compatible provider profiles for extension review responses.",
      };
    },
  });
}

export default async function AdminAiProvidersPage({ params }: PageProps) {
  return renderAuthenticatedAppPage({
    params,
    signInPath: (locale) => `/${locale}/sign-in`,
    async render({ locale, dictionary, user }) {
      if (!(await isAdminEmail(user.email))) {
        notFound();
      }

      return (
        <CoreAppPageShell
          locale={locale}
          dictionary={dictionary}
          user={user}
          surface={{
            eyebrow: "Admin",
            title: "AI provider profiles",
            description: "",
            highlights: [],
          }}
        >
          <AdminAiProviderProfilesCard />
        </CoreAppPageShell>
      );
    },
  });
}
