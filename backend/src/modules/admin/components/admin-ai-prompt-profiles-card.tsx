"use client";

import { Alert, Badge, Box, Button, Card, Group, Portal, Progress, Select, SimpleGrid, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AdminAiPromptProfileListResponse,
  AdminAiPromptProfilePreviewResponse,
  AdminAiPromptProfileResponse,
} from "@/shared/api/admin-ai-prompt-profiles";
import {
  defaultProductDetailsTemplate,
  defaultPromptExamplePayload,
  defaultPromptProfileLabel,
  defaultSystemPrompt,
} from "@/shared/api/admin-ai-prompt-profiles";

type PromptProfile = AdminAiPromptProfileListResponse["profiles"][number];

const newPromptBaseLabel = "New prompt";
const notificationDurationMs = 5000;

function isObject(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null;
}

function getPayloadMessage(payload: unknown) {
  return isObject(payload) && typeof payload.message === "string"
    ? payload.message
    : null;
}

function isProfileListResponse(payload: unknown): payload is AdminAiPromptProfileListResponse {
  return isObject(payload) && Array.isArray(payload.profiles);
}

function isProfileResponse(payload: unknown): payload is AdminAiPromptProfileResponse {
  return isObject(payload) && isObject(payload.profile) && typeof payload.profile.id === "string";
}

function isPreviewResponse(payload: unknown): payload is AdminAiPromptProfilePreviewResponse {
  return isObject(payload) &&
    typeof payload.productDetailsPrompt === "string" &&
    typeof payload.systemPrompt === "string";
}

function formatJson(payload: unknown) {
  return JSON.stringify(payload, null, 2);
}

function createNewPromptLabel(profiles: PromptProfile[]) {
  const normalizedLabels = new Set(
    profiles.map((profile) => profile.label.trim().toLowerCase()),
  );

  if (!normalizedLabels.has(newPromptBaseLabel.toLowerCase())) {
    return newPromptBaseLabel;
  }

  let candidate = `${newPromptBaseLabel} ${profiles.length}`;
  let nextNumber = profiles.length + 1;

  while (normalizedLabels.has(candidate.trim().toLowerCase())) {
    candidate = `${newPromptBaseLabel} ${nextNumber}`;
    nextNumber += 1;
  }

  return candidate;
}

export function AdminAiPromptProfilesCard() {
  const [profiles, setProfiles] = useState<PromptProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [label, setLabel] = useState(defaultPromptProfileLabel);
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);
  const [productDetailsTemplate, setProductDetailsTemplate] = useState(defaultProductDetailsTemplate);
  const [exampleJson, setExampleJson] = useState(formatJson(defaultPromptExamplePayload));
  const [preview, setPreview] = useState<AdminAiPromptProfilePreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notificationProgress, setNotificationProgress] = useState(100);
  const [loading, setLoading] = useState(false);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const isDefaultProfileSelected = Boolean(selectedProfile?.isDefault);
  const notificationMessage = error ?? feedback;
  const notificationColor = error ? "red" : "green";
  const profileOptions = useMemo(
    () => profiles.map((profile) => ({
      value: profile.id,
      label: `${profile.isActive ? "Active — " : ""}${profile.label}`,
    })),
    [profiles],
  );

  function loadProfileIntoEditor(profile: PromptProfile) {
    setSelectedProfileId(profile.id);
    setLabel(profile.label);
    setSystemPrompt(profile.systemPrompt);
    setProductDetailsTemplate(profile.productDetailsTemplate);
    setExampleJson(formatJson(profile.examplePayload));
    setPreview(null);
  }

  const refreshProfiles = useCallback(async (preferredProfileId?: string) => {
    const response = await fetch("/api/admin/ai-prompt-profiles", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as AdminAiPromptProfileListResponse | unknown;

    if (!response.ok || !isProfileListResponse(payload)) {
      throw new Error(getPayloadMessage(payload) ?? "Could not load AI prompt profiles.");
    }

    setProfiles(payload.profiles);

    const nextProfile =
      payload.profiles.find((profile) => profile.id === preferredProfileId) ??
      payload.profiles.find((profile) => profile.id === selectedProfileId) ??
      payload.profiles.find((profile) => profile.isActive) ??
      payload.profiles[0];

    if (nextProfile) {
      loadProfileIntoEditor(nextProfile);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    refreshProfiles().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load AI prompt profiles.");
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
      const remainingProgress = Math.max(0, 100 - (elapsedMs / notificationDurationMs) * 100);
      setNotificationProgress(remainingProgress);
    }, 100);

    const timeoutId = window.setTimeout(() => {
      setError(null);
      setFeedback(null);
    }, notificationDurationMs);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [notificationMessage]);

  function closeNotification() {
    setError(null);
    setFeedback(null);
  }

  function parseExamplePayload() {
    try {
      return JSON.parse(exampleJson);
    } catch {
      throw new Error("Example JSON is invalid.");
    }
  }

  async function createProfile() {
    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const nextLabel = createNewPromptLabel(profiles);
      const response = await fetch("/api/admin/ai-prompt-profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: nextLabel,
          systemPrompt,
          productDetailsTemplate,
          examplePayload: parseExamplePayload(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as AdminAiPromptProfileResponse | unknown;

      if (!response.ok || !isProfileResponse(payload)) {
        throw new Error(getPayloadMessage(payload) ?? "Could not create AI prompt profile.");
      }

      setFeedback(`AI prompt profile was created as "${payload.profile.label}".`);
      await refreshProfiles(payload.profile.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create AI prompt profile.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!selectedProfileId) {
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/ai-prompt-profiles/${encodeURIComponent(selectedProfileId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label,
          systemPrompt,
          productDetailsTemplate,
          examplePayload: parseExamplePayload(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as AdminAiPromptProfileResponse | unknown;

      if (!response.ok || !isProfileResponse(payload)) {
        throw new Error(getPayloadMessage(payload) ?? "Could not save AI prompt profile.");
      }

      setFeedback("AI prompt profile was saved.");
      await refreshProfiles(payload.profile.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save AI prompt profile.");
    } finally {
      setLoading(false);
    }
  }

  async function removeProfile() {
    if (!selectedProfileId || isDefaultProfileSelected) {
      return;
    }

    if (!window.confirm(`Remove prompt profile "${label}"?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/ai-prompt-profiles/${encodeURIComponent(selectedProfileId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean } | unknown;

      if (!response.ok || !isObject(payload) || payload.ok !== true) {
        throw new Error(getPayloadMessage(payload) ?? "Could not remove AI prompt profile.");
      }

      setFeedback(`AI prompt profile "${label}" was removed.`);
      await refreshProfiles();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove AI prompt profile.");
    } finally {
      setLoading(false);
    }
  }

  async function previewProfile() {
    if (!selectedProfileId) {
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/ai-prompt-profiles/${encodeURIComponent(selectedProfileId)}/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productDetailsTemplate,
          examplePayload: parseExamplePayload(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as AdminAiPromptProfilePreviewResponse | unknown;

      if (!response.ok || !isPreviewResponse(payload)) {
        throw new Error(getPayloadMessage(payload) ?? "Could not preview AI prompt profile.");
      }

      setPreview(payload);
      setFeedback("Preview was rendered.");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not preview AI prompt profile.");
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

    try {
      const response = await fetch(`/api/admin/ai-prompt-profiles/${encodeURIComponent(selectedProfileId)}/activate`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as AdminAiPromptProfileResponse | unknown;

      if (!response.ok || !isProfileResponse(payload)) {
        throw new Error(getPayloadMessage(payload) ?? "Could not activate AI prompt profile.");
      }

      setFeedback("AI prompt profile is now active.");
      await refreshProfiles(payload.profile.id);
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Could not activate AI prompt profile.");
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
              withCloseButton
              onClose={closeNotification}
            >
              <Text size="sm">{notificationMessage}</Text>
              <Progress
                color={notificationColor}
                mt="sm"
                radius="xl"
                size="xs"
                value={notificationProgress}
              />
            </Alert>
          </Box>
        </Portal>
      ) : null}

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Prompt profiles</Title>
            {selectedProfile?.isActive ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>}
          </Group>
          <Select
            label="Select profile"
            data={profileOptions}
            value={selectedProfileId}
            onChange={(value) => {
              const profile = profiles.find((item) => item.id === value);
              if (profile) {
                loadProfileIntoEditor(profile);
              }
            }}
          />
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card withBorder radius="lg" p="lg">
          <Stack gap="md">
            <Title order={3}>Edit prompt profile</Title>
            <TextInput label="Label" value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
            <Textarea
              autosize
              minRows={8}
              label="system_prompt"
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.currentTarget.value)}
            />
            <Textarea
              autosize
              minRows={14}
              label="product_details_template"
              description="Allowed placeholders: {{name}}, {{product_details}}, {{feedback_reasons}}, {{rating}}, {{product_name}}, {{product_url}}, {{vendor_code_1}}, {{vendor_code_2}}, {{colors}}, {{size}}"
              value={productDetailsTemplate}
              onChange={(event) => setProductDetailsTemplate(event.currentTarget.value)}
            />
            <Group>
              {isDefaultProfileSelected ? null : (
                <Button loading={loading} onClick={saveProfile} disabled={!selectedProfileId}>Save</Button>
              )}
              <Button
                variant={isDefaultProfileSelected ? "filled" : "light"}
                loading={loading}
                onClick={createProfile}
              >
                Create
              </Button>
              <Button color="green" loading={loading} onClick={activateProfile} disabled={!selectedProfileId || selectedProfile?.isActive}>Activate</Button>
              <Button
                color="red"
                variant="light"
                loading={loading}
                onClick={removeProfile}
                disabled={!selectedProfileId || isDefaultProfileSelected}
              >
                Remove
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="lg" p="lg">
          <Stack gap="md">
            <Title order={3}>Preview</Title>
            <Text c="dimmed" size="sm">
              Preview uses the example parsed JSON below. Real generation uses parsed JSON sent by the extension
              from the open drawer. Unsaved template changes are preview-only until Save is clicked, and only the
              active saved profile is used by the API.
            </Text>
            <Textarea
              autosize
              minRows={14}
              label="Example parsed JSON"
              value={exampleJson}
              onChange={(event) => setExampleJson(event.currentTarget.value)}
            />
            <Button loading={loading} onClick={previewProfile} disabled={!selectedProfileId}>Render preview</Button>
            {preview ? (
              <Stack gap="sm">
                <Text fw={700}>system_prompt</Text>
                <Card withBorder>
                  <Text style={{ whiteSpace: "pre-wrap" }}>{preview.systemPrompt}</Text>
                </Card>
                <Text fw={700}>Rendered product_details prompt</Text>
                <Card withBorder>
                  <Text style={{ whiteSpace: "pre-wrap" }}>{preview.productDetailsPrompt}</Text>
                </Card>
              </Stack>
            ) : (
              <Text c="dimmed">Render a preview to see the final product_details prompt.</Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
