"use client";

import { Alert, Badge, Box, Button, Card, Group, Loader, NumberInput, PasswordInput, Portal, Progress, Select, Stack, Table, TagsInput, Text, TextInput, Title } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";

import type {
  AdminAiProviderProfileCheckResponse,
  AdminAiProviderProfileListResponse,
  AdminAiProviderProfileModelsResponse,
  AiProviderRouting,
  CreateAdminAiProviderProfileResponse,
} from "@/shared/api/admin-ai-provider-profiles";

type ProviderProfile = AdminAiProviderProfileListResponse["profiles"][number];
type RoutingMode = AiProviderRouting["mode"];

const routingModeOptions = [
  { value: "default", label: "Default" },
  { value: "fallback", label: "Fallback" },
  { value: "only-one", label: "Only one" },
];
const notificationDurationMs = 5000;

function buildProviderRouting(mode: RoutingMode, order: string[], only: string): AiProviderRouting {
  if (mode === "fallback") {
    return { mode, order };
  }

  if (mode === "only-one") {
    return { mode, only };
  }

  return { mode: "default" };
}

function isObject(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null;
}

function getPayloadMessage(payload: unknown) {
  return isObject(payload) &&
    "message" in payload &&
    typeof payload.message === "string"
    ? payload.message
    : null;
}

function isProfileListResponse(payload: unknown): payload is AdminAiProviderProfileListResponse {
  return isObject(payload) && Array.isArray(payload.profiles);
}

function isCreateProfileResponse(payload: unknown): payload is CreateAdminAiProviderProfileResponse {
  return isObject(payload) && isObject(payload.profile) && typeof payload.profile.id === "string";
}

function isModelsResponse(payload: unknown): payload is AdminAiProviderProfileModelsResponse {
  return isObject(payload) && Array.isArray(payload.models);
}

function isCheckResponse(payload: unknown): payload is AdminAiProviderProfileCheckResponse {
  return isObject(payload) && typeof payload.responseText === "string" && typeof payload.model === "string";
}

export function AdminAiProviderProfilesCard() {
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [models, setModels] = useState<Array<{ id: string }>>([]);
  const [label, setLabel] = useState("Kimi profile");
  const [baseUrl, setBaseUrl] = useState("https://api.moonshot.ai/v1");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("kimi-k2.5");
  const [temperature, setTemperature] = useState<number | string>(1);
  const [maxTokens, setMaxTokens] = useState<number | string>(2000);
  const [maxCompletionTokens, setMaxCompletionTokens] = useState<number | string>(2000);
  const [routingMode, setRoutingMode] = useState<RoutingMode>("default");
  const [providerOrder, setProviderOrder] = useState<string[]>([]);
  const [providerOnly, setProviderOnly] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedTemperature, setSelectedTemperature] = useState<number | string>(1);
  const [selectedMaxTokens, setSelectedMaxTokens] = useState<number | string>(2000);
  const [selectedMaxCompletionTokens, setSelectedMaxCompletionTokens] = useState<number | string>(2000);
  const [selectedRoutingMode, setSelectedRoutingMode] = useState<RoutingMode>("default");
  const [selectedProviderOrder, setSelectedProviderOrder] = useState<string[]>([]);
  const [selectedProviderOnly, setSelectedProviderOnly] = useState("");
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notificationProgress, setNotificationProgress] = useState(100);
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const notificationMessage = error ?? (checkResult ? `Check response: ${checkResult}` : feedback);
  const notificationColor = error ? "red" : checkResult ? "blue" : "green";
  const modelOptions = Array.from(
    new Set([
      selectedProfile?.defaultModel,
      selectedModel,
      ...models.map((model) => model.id),
    ].filter((model): model is string => Boolean(model))),
  ).map((model) => ({ value: model, label: model }));

  const refreshProfiles = useCallback(async (preferredProfileId?: string) => {
    const response = await fetch("/api/admin/ai-provider-profiles", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as AdminAiProviderProfileListResponse | unknown;

    if (!response.ok || !isProfileListResponse(payload)) {
      throw new Error(getPayloadMessage(payload) ?? "Could not load AI provider profiles.");
    }

    setProfiles(payload.profiles);

    const nextSelectedProfile =
      payload.profiles.find((profile) => profile.id === (preferredProfileId ?? selectedProfileId)) ??
      (!selectedProfileId ? (payload.profiles.find((profile) => profile.isActive) ?? payload.profiles[0]) : null);

    if (nextSelectedProfile) {
      setSelectedProfileId(nextSelectedProfile.id);
      setSelectedModel(nextSelectedProfile.defaultModel);
      setSelectedTemperature(nextSelectedProfile.temperature);
      setSelectedMaxTokens(nextSelectedProfile.maxTokens);
      setSelectedMaxCompletionTokens(nextSelectedProfile.maxCompletionTokens);
      setSelectedRoutingMode(nextSelectedProfile.providerRouting.mode);
      setSelectedProviderOrder(nextSelectedProfile.providerRouting.mode === "fallback" ? nextSelectedProfile.providerRouting.order : []);
      setSelectedProviderOnly(nextSelectedProfile.providerRouting.mode === "only-one" ? nextSelectedProfile.providerRouting.only : "");
      setModels(nextSelectedProfile.availableModels.map((id) => ({ id })));
    }
  }, [selectedProfileId]);

  useEffect(() => {
    refreshProfiles().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load AI provider profiles.");
    });
  }, [refreshProfiles]);

  useEffect(() => {
    if (!notificationMessage) {
      return undefined;
    }

    const startedAt = Date.now();
    setNotificationProgress(100);

    const intervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      setNotificationProgress(Math.max(0, 100 - (elapsedMs / notificationDurationMs) * 100));
    }, 100);
    const timeoutId = window.setTimeout(() => {
      setError(null);
      setFeedback(null);
      setCheckResult(null);
    }, notificationDurationMs);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [notificationMessage]);

  function closeNotification() {
    setError(null);
    setFeedback(null);
    setCheckResult(null);
  }

  async function createProfile() {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setCheckResult(null);

    try {
      const response = await fetch("/api/admin/ai-provider-profiles", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          label,
          baseUrl,
          apiKey,
          defaultModel: defaultModel || undefined,
          temperature: Number(temperature),
          maxTokens: Number(maxTokens),
          maxCompletionTokens: Number(maxCompletionTokens),
          providerRouting: buildProviderRouting(routingMode, providerOrder, providerOnly),
        }),
      });
      const payload = (await response.json().catch(() => null)) as CreateAdminAiProviderProfileResponse | unknown;

      if (!response.ok || !isCreateProfileResponse(payload)) {
        throw new Error(getPayloadMessage(payload) ?? "Could not create AI provider profile.");
      }

      setFeedback("AI provider profile was created.");
      setApiKey("");
      setSelectedProfileId(payload.profile.id);
      setSelectedModel(payload.profile.defaultModel);
      await refreshProfiles(payload.profile.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create AI provider profile.");
    } finally {
      setLoading(false);
    }
  }

  async function loadModels(profileId = selectedProfileId) {
    if (!profileId) {
      return;
    }

    setModelsLoading(true);
    setError(null);
    setFeedback(null);
    setCheckResult(null);

    try {
      const response = await fetch(`/api/admin/ai-provider-profiles/${encodeURIComponent(profileId)}/models`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as AdminAiProviderProfileModelsResponse | unknown;

      if (!response.ok || !isModelsResponse(payload)) {
        throw new Error(getPayloadMessage(payload) ?? "Could not load provider models.");
      }

      setModels(payload.models);
      setFeedback(`Loaded ${payload.models.length} model(s).`);
      await refreshProfiles(profileId);
    } catch (modelsError) {
      setError(modelsError instanceof Error ? modelsError.message : "Could not load provider models.");
    } finally {
      setModelsLoading(false);
    }
  }

  async function saveProfileSettings() {
    if (!selectedProfileId || !selectedModel) {
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);
    setCheckResult(null);

    try {
      const response = await fetch(`/api/admin/ai-provider-profiles/${encodeURIComponent(selectedProfileId)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          defaultModel: selectedModel,
          temperature: Number(selectedTemperature),
          maxTokens: Number(selectedMaxTokens),
          maxCompletionTokens: Number(selectedMaxCompletionTokens),
          providerRouting: buildProviderRouting(
            selectedRoutingMode,
            selectedProviderOrder,
            selectedProviderOnly,
          ),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? "Could not update provider settings.");
      }

      setFeedback("Provider settings were saved.");
      await refreshProfiles();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update provider settings.");
    } finally {
      setLoading(false);
    }
  }

  async function checkProfile() {
    if (!selectedProfileId) {
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);
    setCheckResult(null);

    try {
      const response = await fetch(`/api/admin/ai-provider-profiles/${encodeURIComponent(selectedProfileId)}/check`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel || selectedProfile?.defaultModel || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as AdminAiProviderProfileCheckResponse | unknown;

      if (!response.ok || !isCheckResponse(payload)) {
        throw new Error(getPayloadMessage(payload) ?? "Provider check failed.");
      }

      setCheckResult(payload.responseText);
      setFeedback(`Provider check succeeded with ${payload.model}.`);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Provider check failed.");
    } finally {
      setLoading(false);
    }
  }

  async function activateProfile() {
    if (!selectedProfileId) {
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);
    setCheckResult(null);

    try {
      const response = await fetch(`/api/admin/ai-provider-profiles/${encodeURIComponent(selectedProfileId)}/activate`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? "Could not activate AI provider profile.");
      }

      setFeedback("AI provider profile is now active.");
      await refreshProfiles(selectedProfileId);
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Could not activate AI provider profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="lg">
      {notificationMessage ? (
        <Portal>
          <Box
            style={{
              left: "50%",
              maxWidth: "calc(100vw - 32px)",
              position: "fixed",
              top: 20,
              transform: "translateX(-50%)",
              width: 520,
              zIndex: 10000,
            }}
          >
            <Alert
              color={notificationColor}
              radius="lg"
              title={error ? "Action failed" : "Action completed"}
              variant="filled"
              withCloseButton
              onClose={closeNotification}
            >
              <Text size="sm">{notificationMessage}</Text>
              <Progress color="white" mt="sm" radius="xl" size="xs" value={notificationProgress} />
            </Alert>
          </Box>
        </Portal>
      ) : null}

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Create AI provider profile</Title>
          <TextInput label="Profile label" value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
          <TextInput label="OpenAI-compatible base URL" value={baseUrl} onChange={(event) => setBaseUrl(event.currentTarget.value)} />
          <PasswordInput label="Provider API key" value={apiKey} onChange={(event) => setApiKey(event.currentTarget.value)} />
          <TextInput label="Default model" value={defaultModel} onChange={(event) => setDefaultModel(event.currentTarget.value)} />
          <Group grow align="start">
            <NumberInput label="Temperature" min={0} max={2} step={0.1} decimalScale={2} value={temperature} onChange={setTemperature} />
            <NumberInput label="Max tokens" min={1} max={1_000_000} step={1} allowDecimal={false} value={maxTokens} onChange={setMaxTokens} />
            <NumberInput label="Max completion tokens" min={1} max={1_000_000} step={1} allowDecimal={false} value={maxCompletionTokens} onChange={setMaxCompletionTokens} />
          </Group>
          <Select label="Provider routing" value={routingMode} onChange={(value) => setRoutingMode((value ?? "default") as RoutingMode)} data={routingModeOptions} />
          {routingMode === "fallback" ? (
            <TagsInput label="Providers in fallback order" description="Enter provider names in priority order." value={providerOrder} onChange={setProviderOrder} />
          ) : null}
          {routingMode === "only-one" ? (
            <TextInput label="Only provider" value={providerOnly} onChange={(event) => setProviderOnly(event.currentTarget.value)} />
          ) : null}
          {routingMode !== "default" ? <Text size="xs" c="dimmed">Provider routing is a nonstandard option. Enable it only when the configured API supports it.</Text> : null}
          <Button
            disabled={
              typeof temperature !== "number" ||
              typeof maxTokens !== "number" ||
              typeof maxCompletionTokens !== "number" ||
              (routingMode === "fallback" && providerOrder.length === 0) ||
              (routingMode === "only-one" && !providerOnly.trim())
            }
            loading={loading}
            onClick={createProfile}
          >
            Create profile
          </Button>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Provider profiles</Title>
            <Button variant="light" loading={loading} onClick={() => refreshProfiles()}>Refresh</Button>
          </Group>
          <Table verticalSpacing="sm" style={{ tableLayout: "fixed", width: "100%" }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Label</Table.Th>
                  <Table.Th>Base URL</Table.Th>
                  <Table.Th>Default model</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={90} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {profiles.map((profile) => (
                  <Table.Tr key={profile.id}>
                    <Table.Td style={{ overflowWrap: "anywhere" }}>{profile.label}</Table.Td>
                    <Table.Td style={{ overflowWrap: "anywhere" }}>{profile.baseUrl}</Table.Td>
                    <Table.Td style={{ overflowWrap: "anywhere" }}>{profile.defaultModel ?? "—"}</Table.Td>
                    <Table.Td>{profile.isActive ? <Badge color="green">Active</Badge> : <Badge variant="light">Inactive</Badge>}</Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant={selectedProfileId === profile.id ? "filled" : "light"}
                        onClick={() => {
                          setSelectedProfileId(profile.id);
                          setSelectedModel(profile.defaultModel);
                          setSelectedTemperature(profile.temperature);
                          setSelectedMaxTokens(profile.maxTokens);
                          setSelectedMaxCompletionTokens(profile.maxCompletionTokens);
                          setSelectedRoutingMode(profile.providerRouting.mode);
                          setSelectedProviderOrder(profile.providerRouting.mode === "fallback" ? profile.providerRouting.order : []);
                          setSelectedProviderOnly(profile.providerRouting.mode === "only-one" ? profile.providerRouting.only : "");
                          setModels(profile.availableModels.map((id) => ({ id })));
                          setCheckResult(null);
                        }}
                      >
                        Select
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Models and check</Title>
          {selectedProfile ? (
            <Group gap="xs">
              <Text size="sm">Selected: {selectedProfile.label}</Text>
              {selectedProfile.isActive ? <Badge color="green">Active globally</Badge> : <Badge variant="light">Inactive</Badge>}
            </Group>
          ) : (
            <Text size="sm">Create or select a provider profile first.</Text>
          )}
          <Group>
            <Button disabled={!selectedProfileId} loading={modelsLoading} onClick={() => loadModels()}>
              Refresh models list
            </Button>
            <Button disabled={!selectedProfileId} loading={loading} onClick={checkProfile}>
              Check provider
            </Button>
            <Button disabled={!selectedProfileId || Boolean(selectedProfile?.isActive)} loading={loading} onClick={activateProfile}>
              Activate globally
            </Button>
          </Group>
          <Select
            label="Model"
            searchable
            value={selectedModel}
            onChange={setSelectedModel}
            data={modelOptions}
            placeholder={selectedProfile?.defaultModel ?? "Load models first"}
            rightSection={modelsLoading ? <Loader size="xs" /> : undefined}
            rightSectionPointerEvents="none"
          />
          <Group grow align="start">
            <NumberInput label="Temperature" min={0} max={2} step={0.1} decimalScale={2} value={selectedTemperature} onChange={setSelectedTemperature} />
            <NumberInput label="Max tokens" min={1} max={1_000_000} step={1} allowDecimal={false} value={selectedMaxTokens} onChange={setSelectedMaxTokens} />
            <NumberInput label="Max completion tokens" min={1} max={1_000_000} step={1} allowDecimal={false} value={selectedMaxCompletionTokens} onChange={setSelectedMaxCompletionTokens} />
          </Group>
          <Select label="Provider routing" value={selectedRoutingMode} onChange={(value) => setSelectedRoutingMode((value ?? "default") as RoutingMode)} data={routingModeOptions} />
          {selectedRoutingMode === "fallback" ? (
            <TagsInput label="Providers in fallback order" description="Enter provider names in priority order." value={selectedProviderOrder} onChange={setSelectedProviderOrder} />
          ) : null}
          {selectedRoutingMode === "only-one" ? (
            <TextInput label="Only provider" value={selectedProviderOnly} onChange={(event) => setSelectedProviderOnly(event.currentTarget.value)} />
          ) : null}
          {selectedRoutingMode !== "default" ? <Text size="xs" c="dimmed">Provider routing is a nonstandard option. Enable it only when the configured API supports it.</Text> : null}
          <Button
            disabled={
              !selectedProfileId ||
              !selectedModel ||
              typeof selectedTemperature !== "number" ||
              typeof selectedMaxTokens !== "number" ||
              typeof selectedMaxCompletionTokens !== "number" ||
              (selectedRoutingMode === "fallback" && selectedProviderOrder.length === 0) ||
              (selectedRoutingMode === "only-one" && !selectedProviderOnly.trim())
            }
            loading={loading}
            onClick={saveProfileSettings}
          >
            Save profile settings
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
