import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconChecklist,
  IconKey,
  IconMessageChatbot,
  IconRobot,
  IconUsers,
} from "@tabler/icons-react";

import { SiteHeader } from "@/components/site-header";
import type { AuthenticatedUser } from "@/types/auth";
import type { SiteDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { getModuleNavItems } from "@/modules/navigation";

type HomePageProps = {
  dictionary: SiteDictionary;
  isAdmin: boolean;
  locale: Locale;
  user: AuthenticatedUser | null;
};

export function HomePage({ dictionary, isAdmin, locale, user }: HomePageProps) {
  const marketingModuleLinks = getModuleNavItems("marketing", locale);
  const appModuleLinks = getModuleNavItems("app", locale);
  const adminLinks = [
    {
      href: `/${locale}/admin/api-keys`,
      title: "Extension API keys",
      description: "Create extension API keys, find a key by value, adjust quota, invalidate keys, and inspect usage history.",
      icon: IconKey,
    },
    {
      href: `/${locale}/admin/ai-providers`,
      title: "AI provider profiles",
      description: "Configure OpenAI-compatible providers, save provider API keys, list available models, and run connection checks.",
      icon: IconRobot,
    },
    {
      href: `/${locale}/admin/prompts`,
      title: "AI prompts",
      description: "Edit the active system prompt, product-details template, and preview rendering from parsed extension JSON.",
      icon: IconMessageChatbot,
    },
    {
      href: `/${locale}/workspace`,
      title: "Workspace and user access",
      description: "Open the workspace admin tools to review users, workspace roles, and module access.",
      icon: IconUsers,
    },
  ];
  return (
    <>
      <Box component="main" py={32}>
        <Container size={1380}>
          <Paper
            radius={28}
            p="xl"
            style={{
              background: "var(--surface)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--line)",
              boxShadow: "0 24px 80px rgba(17, 33, 45, 0.08)",
            }}
          >
            <Stack gap="xl">
              <SiteHeader
                dictionary={dictionary.header}
                locale={locale}
                user={user}
                marketingModuleLinks={marketingModuleLinks}
                appModuleLinks={appModuleLinks}
                showMarketingNav={false}
              />

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1.5rem",
                  alignItems: "stretch",
                }}
              >
              <Stack
                justify="center"
                gap="lg"
                h="100%"
                style={{ flex: "1.35 1 720px", minWidth: 0 }}
              >
                <Badge variant="light" color="teal" radius="xl" size="lg" w="fit-content">
                  WB AI Helper backend
                </Badge>
                <Title
                  order={1}
                  maw={860}
                  lh={1}
                  style={{ fontSize: "clamp(3rem, 6vw, 5.5rem)" }}
                >
                  Admin control panel
                </Title>
                <Text size="xl" c="dimmed" maw={720}>
                  Manage extension API access, AI-provider settings, and backend administration from one place.
                </Text>
                <Group gap="md">
                  {user ? (
                    <Button size="xl" color="teal" component="a" href={`/${locale}/workspace`}>
                      Open workspace
                    </Button>
                  ) : (
                    <>
                      <Button size="xl" color="teal" component="a" href={`/${locale}/sign-up`}>
                        {dictionary.auth.signUp.submit}
                      </Button>
                      <Button size="xl" variant="default" component="a" href={`/${locale}/sign-in`}>
                        {dictionary.auth.signIn.submit}
                      </Button>
                    </>
                  )}
                </Group>
              </Stack>

              <div style={{ flex: "0.95 1 440px", minWidth: 0 }}>
                <Card
                  radius={24}
                  p="xl"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(12, 30, 40, 0.98), rgba(21, 52, 57, 0.92))",
                    color: "white",
                    boxShadow: "0 28px 60px rgba(17, 33, 45, 0.24)",
                  }}
                >
                  <Stack gap="lg" h="100%">
                    <Group justify="space-between">
                      <div>
                        <Text c="teal.2" size="sm" fw={700}>
                          Admin status
                        </Text>
                        <Title order={3} c="white">
                          {user ? "Signed in" : "Sign in required"}
                        </Title>
                      </div>
                      <Badge color="teal" variant="filled">
                        {isAdmin ? "Admin" : "User"}
                      </Badge>
                    </Group>

                    <Card radius={20} p="lg" bg="rgba(255,255,255,0.06)" mt="auto">
                      <Text size="sm" c="gray.2">
                        Available tools
                      </Text>
                      <Title order={3} c="white" mt="xs">
                        {isAdmin ? "Admin links are enabled" : "Admin access is required"}
                      </Title>
                      <Stack gap="sm" mt="md">
                        {[
                          "Extension API-key quota and audit controls",
                          "AI-provider profile and model checks",
                          "Workspace access review",
                        ].map((item) => (
                          <Group key={item} wrap="nowrap" align="flex-start">
                            <ThemeIcon color="teal" size={22} radius="xl" mt={2}>
                              <IconChecklist size={14} />
                            </ThemeIcon>
                            <Text c="gray.1">{item}</Text>
                          </Group>
                        ))}
                      </Stack>
                    </Card>
                  </Stack>
                </Card>
                </div>
              </div>

              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                {adminLinks.map(({ href, title, description, icon: Icon }) => (
                  <Card
                    key={title}
                    radius={22}
                    p="xl"
                    style={{
                      background: "var(--surface-strong)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <ThemeIcon size={48} radius="md" color="dark">
                      <Icon size={24} />
                    </ThemeIcon>
                    <Title order={3} mt="lg" mb="sm" fz={24}>
                      {title}
                    </Title>
                    <Text c="dimmed">{description}</Text>
                    <Button
                      component="a"
                      href={isAdmin ? href : `/${locale}/sign-in`}
                      mt="lg"
                      variant={isAdmin ? "filled" : "light"}
                      color="teal"
                      disabled={Boolean(user) && !isAdmin}
                    >
                      {isAdmin ? "Open" : user ? "Admin only" : "Sign in"}
                    </Button>
                  </Card>
                ))}
              </SimpleGrid>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </>
  );
}
