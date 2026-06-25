import type { Locale } from "@/lib/i18n/config";
import type { SiteDictionary } from "@/lib/i18n/dictionaries";
import { getModuleNavItems } from "@/modules/navigation";

export type AppNavigationItem = {
  id: string;
  label: string;
  href: string;
};

export function getAppNavigation(
  locale: Locale,
  dictionary: SiteDictionary,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): AppNavigationItem[] {
  const coreItems: AppNavigationItem[] = [
    {
      id: "profile",
      label: dictionary.header.user.profile,
      href: `/${locale}/profile`,
    },
    {
      id: "settings",
      label: dictionary.header.user.settings,
      href: `/${locale}/settings`,
    },
  ];

  if (isAdmin) {
    coreItems.push({
      id: "admin-api-keys",
      label: dictionary.app.adminApiKeys.navLabel,
      href: `/${locale}/admin/api-keys`,
    });
    coreItems.push({
      id: "admin-ai-providers",
      label: "AI providers",
      href: `/${locale}/admin/ai-providers`,
    });
    coreItems.push({
      id: "admin-prompts",
      label: "Prompts",
      href: `/${locale}/admin/prompts`,
    });
  }

  const moduleItems = getModuleNavItems("app", locale).map(({ id, label, href }) => ({
    id,
    label,
    href,
  }));

  return [...coreItems, ...moduleItems];
}
