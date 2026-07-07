import { Badge, Box, Card, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

import { getAppNavigation } from "@/core/navigation/app-navigation";
import {
  WorkspaceShellProvider,
  WorkspaceShellSwitcher,
} from "@/core/workspaces/workspace-shell-context";
import { AppSectionNav } from "@/components/app/app-section-nav";
import { WorkspaceAwareSiteHeader } from "@/components/app/workspace-aware-site-header";
import { isAdminEmail } from "@/lib/admin";
import type { Locale } from "@/lib/i18n/config";
import type { SiteDictionary } from "@/lib/i18n/dictionaries";
import { getModuleNavItems } from "@/modules/navigation";
import type { AuthenticatedUser } from "@/types/auth";

type AppPageShellProps = {
  locale: Locale;
  dictionary: SiteDictionary;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  user: AuthenticatedUser;
  children?: ReactNode;
};

export async function AppPageShell({
  locale,
  dictionary,
  eyebrow,
  title,
  description,
  user,
  children,
}: AppPageShellProps) {
  const isAdmin = await isAdminEmail(user.email);
  const appNavigation = getAppNavigation(locale, dictionary, { isAdmin });
  const marketingModuleLinks = getModuleNavItems("marketing", locale);
  const appModuleLinks = getModuleNavItems("app", locale);

  return (
    <Box component="main" py={32}>
      <Container size={1180}>
        <WorkspaceShellProvider dictionary={dictionary.app.shared}>
          <Paper
            radius={28}
            p="xl"
            style={{
              background: "var(--surface)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--line)",
              boxShadow: "var(--panel-shadow)",
            }}
          >
            <Stack gap="xl">
              <WorkspaceAwareSiteHeader
                dictionary={dictionary}
                locale={locale}
                user={user}
                marketingModuleLinks={marketingModuleLinks}
                appModuleLinks={appModuleLinks}
              />
              <AppSectionNav items={appNavigation} />

              <Card
                radius={24}
                p={{ base: "lg", md: "xl" }}
                style={{
                  background: "var(--surface-strong)",
                  border: "1px solid var(--line)",
                }}
              >
                <Stack gap="md">
                  <Badge variant="light" color="teal" radius="xl" w="fit-content">
                    {eyebrow}
                  </Badge>
                  <Title order={1}>{title}</Title>
                  {description ? (
                    <Text size="lg" c="dimmed" maw={760}>
                      {description}
                    </Text>
                  ) : null}

                  {description ? (
                    <Group gap="lg" mt="md" align="end">
                      <InfoStat label={dictionary.app.shared.localeLabel} value={locale.toUpperCase()} />
                      <InfoStat
                        label={dictionary.app.shared.surfaceLabel}
                        value={dictionary.app.shared.surfaceValue}
                      />
                      <InfoStat
                        label={dictionary.app.shared.modeLabel}
                        value={dictionary.app.shared.modeValue}
                      />
                      <WorkspaceShellSwitcher dictionary={dictionary.app.shared} />
                    </Group>
                  ) : null}
                </Stack>
              </Card>

              {children}
            </Stack>
          </Paper>
        </WorkspaceShellProvider>
      </Container>
    </Box>
  );
}

type InfoStatProps = {
  label: string;
  value: string;
};

function InfoStat({ label, value }: InfoStatProps) {
  return (
    <div>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
    </div>
  );
}
