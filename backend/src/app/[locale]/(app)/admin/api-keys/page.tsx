import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  generateAuthenticatedAppPageMetadata,
  renderAuthenticatedAppPage,
} from "@/core/routes/authenticated-app-route";
import { CoreAppPageShell } from "@/core/pages/core-app-page-shell";
import { isAdminEmail } from "@/lib/admin";
import { AdminExtensionApiKeysCard } from "@/modules/admin/components/admin-extension-api-keys-card";

type PageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return generateAuthenticatedAppPageMetadata({
    params,
    canonicalPath: (locale) => `/${locale}/admin/api-keys`,
    resolveMetadata(dictionary) {
      return {
        title: dictionary.app.adminApiKeys.title,
        description: dictionary.app.adminApiKeys.description,
      };
    },
  });
}

export default async function AdminApiKeysPage({ params }: PageProps) {
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
            eyebrow: dictionary.app.adminApiKeys.eyebrow,
            title: dictionary.app.adminApiKeys.title,
            description: "",
            highlights: [],
          }}
        >
          <AdminExtensionApiKeysCard dictionary={dictionary.app.adminApiKeys} />
        </CoreAppPageShell>
      );
    },
  });
}
