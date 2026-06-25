"use client";

import { Alert, Button, Card, Group, PasswordInput, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";

import type {
  AdminAiProviderProfileCheckResponse,
  AdminAiProviderProfileListResponse,
  AdminAiProviderProfileModelsResponse,
  CreateAdminAiProviderProfileResponse,
} from "@/shared/api/admin-ai-provider-profiles";

type ProviderProfile = AdminAiProviderProfileListResponse["profiles"][number];

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
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
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
      (!selectedProfileId ? payload.profiles[0] : null);

    if (nextSelectedProfile) {
      setSelectedProfileId(nextSelectedProfile.id);
      setSelectedModel(nextSelectedProfile.defaultModel);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    refreshProfiles().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load AI provider profiles.");
    });
  }, [refreshProfiles]);

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

    setLoading(true);
    setError(null);
    setFeedback(null);

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
    } catch (modelsError) {
      setError(modelsError instanceof Error ? modelsError.message : "Could not load provider models.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDefaultModel() {
    if (!selectedProfileId || !selectedModel) {
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/ai-provider-profiles/${encodeURIComponent(selectedProfileId)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          defaultModel: selectedModel,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? "Could not update default model.");
      }

      setFeedback("Default model was saved.");
      await refreshProfiles();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update default model.");
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

  return (
    <Stack gap="lg">
      {error ? <Alert color="red">{error}</Alert> : null}
      {feedback ? <Alert color="green">{feedback}</Alert> : null}
      {checkResult ? <Alert color="blue">Check response: {checkResult}</Alert> : null}

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Create AI provider profile</Title>
          <TextInput label="Profile label" value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
          <TextInput label="OpenAI-compatible base URL" value={baseUrl} onChange={(event) => setBaseUrl(event.currentTarget.value)} />
          <PasswordInput label="Provider API key" value={apiKey} onChange={(event) => setApiKey(event.currentTarget.value)} />
          <TextInput label="Default model" value={defaultModel} onChange={(event) => setDefaultModel(event.currentTarget.value)} />
          <Button loading={loading} onClick={createProfile}>Create profile</Button>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Provider profiles</Title>
            <Button variant="light" loading={loading} onClick={() => refreshProfiles()}>Refresh</Button>
          </Group>
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Label</Table.Th>
                  <Table.Th>Base URL</Table.Th>
                  <Table.Th>Default model</Table.Th>
                  <Table.Th>API key</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {profiles.map((profile) => (
                  <Table.Tr key={profile.id}>
                    <Table.Td>{profile.label}</Table.Td>
                    <Table.Td>{profile.baseUrl}</Table.Td>
                    <Table.Td>{profile.defaultModel ?? "—"}</Table.Td>
                    <Table.Td>{profile.apiKeyPreview ?? (profile.hasApiKey ? "saved" : "missing")}</Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant={selectedProfileId === profile.id ? "filled" : "light"}
                        onClick={() => {
                          setSelectedProfileId(profile.id);
                          setSelectedModel(profile.defaultModel);
                          setModels([]);
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
          </Table.ScrollContainer>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Models and check</Title>
          {selectedProfile ? (
            <Text size="sm">Selected: {selectedProfile.label}</Text>
          ) : (
            <Text size="sm">Create or select a provider profile first.</Text>
          )}
          <Group>
            <Button disabled={!selectedProfileId} loading={loading} onClick={() => loadModels()}>
              List models
            </Button>
            <Button disabled={!selectedProfileId} loading={loading} onClick={checkProfile}>
              Check provider
            </Button>
          </Group>
          <Select
            label="Model"
            searchable
            value={selectedModel}
            onChange={setSelectedModel}
            data={modelOptions}
            placeholder={selectedProfile?.defaultModel ?? "Load models first"}
          />
          <Button disabled={!selectedProfileId || !selectedModel} loading={loading} onClick={saveDefaultModel}>
            Save selected model as default
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
