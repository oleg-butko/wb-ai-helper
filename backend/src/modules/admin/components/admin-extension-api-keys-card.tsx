"use client";

import { Alert, Badge, Button, Card, CopyButton, Group, NumberInput, Stack, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";

import type {
  AdminExtensionApiKeyDetailResponse,
  AdminExtensionApiKeyListResponse,
  CreateAdminExtensionApiKeyResponse,
} from "@/shared/api/admin-extension-api-keys";

type ApiKeySummary = AdminExtensionApiKeyListResponse["apiKeys"][number];
type ApiKeyDetail = AdminExtensionApiKeyDetailResponse["result"];

function getPayloadMessage(payload: unknown) {
  return typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
    ? payload.message
    : null;
}

function isCreateApiKeyResponse(payload: unknown): payload is CreateAdminExtensionApiKeyResponse {
  return typeof payload === "object" &&
    payload !== null &&
    "rawApiKey" in payload &&
    typeof payload.rawApiKey === "string";
}

export function AdminExtensionApiKeysCard() {
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ApiKeyDetail | null>(null);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [quota, setQuota] = useState(10);
  const [searchKey, setSearchKey] = useState("");
  const [quotaAmount, setQuotaAmount] = useState(10);
  const [quotaReason, setQuotaReason] = useState("");
  const [invalidationReason, setInvalidationReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshList = useCallback(async () => {
    const response = await fetch("/api/admin/extension-api-keys?limit=50", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message ?? "Could not load API keys.");
    }

    setApiKeys(payload.apiKeys ?? []);
  }, []);

  useEffect(() => {
    refreshList().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load API keys.");
    });
  }, [refreshList]);

  async function createApiKey() {
    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/extension-api-keys", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          label: label || undefined,
          quota,
          reason: "initial quota",
        }),
      });
      const payload = (await response.json().catch(() => null)) as CreateAdminExtensionApiKeyResponse | unknown;

      if (!response.ok || !isCreateApiKeyResponse(payload)) {
        throw new Error(getPayloadMessage(payload) ?? "Could not create API key.");
      }

      setCreatedRawKey(payload.rawApiKey);
      setFeedback("API key created. Copy it now; it will not be shown again.");
      setLabel("");
      await refreshList();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create API key.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(apiKeyId: string) {
    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/extension-api-keys/${encodeURIComponent(apiKeyId)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not load API key details.");
      }

      setSelectedDetail(payload.result);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Could not load API key details.");
    } finally {
      setLoading(false);
    }
  }

  async function findByValue() {
    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/extension-api-keys/find", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          apiKey: searchKey,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not find API key.");
      }

      setSelectedDetail(payload.result);
      setFeedback(payload.result ? "API key found." : "No API key matched that value.");
    } catch (findError) {
      setError(findError instanceof Error ? findError.message : "Could not find API key.");
    } finally {
      setLoading(false);
    }
  }

  async function adjustQuota(direction: "grant" | "remove") {
    if (!selectedDetail) {
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/extension-api-keys/${encodeURIComponent(selectedDetail.apiKey.id)}/quota-events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          direction,
          amount: quotaAmount,
          reason: quotaReason || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not update quota.");
      }

      setFeedback("Quota updated.");
      await refreshList();
      await loadDetail(payload.apiKey.id);
    } catch (quotaError) {
      setError(quotaError instanceof Error ? quotaError.message : "Could not update quota.");
    } finally {
      setLoading(false);
    }
  }

  async function invalidateKey() {
    if (!selectedDetail) {
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/extension-api-keys/${encodeURIComponent(selectedDetail.apiKey.id)}/invalidate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: invalidationReason || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not invalidate API key.");
      }

      setFeedback("API key invalidated.");
      await refreshList();
      await loadDetail(payload.apiKey.id);
    } catch (invalidateError) {
      setError(invalidateError instanceof Error ? invalidateError.message : "Could not invalidate API key.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="lg">
      {error ? <Alert color="red">{error}</Alert> : null}
      {feedback ? <Alert color="green">{feedback}</Alert> : null}
      {createdRawKey ? (
        <Alert color="yellow">
          <Group justify="space-between" align="center">
            <Text>
              Raw API key: <code>{createdRawKey}</code>
            </Text>
            <CopyButton value={createdRawKey}>
              {({ copied, copy }) => (
                <Button size="xs" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Alert>
      ) : null}

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Create API key</Title>
          <TextInput label="Label" value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
          <NumberInput label="Initial quota" min={0} max={1_000_000} value={quota} onChange={(value) => setQuota(Number(value) || 0)} />
          <Button loading={loading} onClick={createApiKey}>Create key</Button>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Find by API key value</Title>
          <Textarea label="Raw API key" value={searchKey} onChange={(event) => setSearchKey(event.currentTarget.value)} />
          <Button loading={loading} onClick={findByValue}>Find key</Button>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Recent API keys</Title>
            <Button variant="light" loading={loading} onClick={() => refreshList()}>Refresh</Button>
          </Group>
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Label</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Quota</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {apiKeys.map((apiKey) => (
                  <Table.Tr key={apiKey.id}>
                    <Table.Td>{apiKey.label ?? apiKey.id}</Table.Td>
                    <Table.Td>
                      <Badge color={apiKey.invalidatedAt ? "red" : "green"}>
                        {apiKey.invalidatedAt ? "invalidated" : "active"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{apiKey.quotaUsed} / {apiKey.quotaTotal}</Table.Td>
                    <Table.Td>{apiKey.createdAt ?? "—"}</Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="light" loading={loading} onClick={() => loadDetail(apiKey.id)}>Open</Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>

      {selectedDetail ? (
        <Card withBorder radius="lg" p="lg">
          <Stack gap="md">
            <Title order={3}>Selected key</Title>
            <Text>ID: <code>{selectedDetail.apiKey.id}</code></Text>
            <Text>Quota remaining: {selectedDetail.apiKey.quotaRemaining}</Text>
            <Text>Status: {selectedDetail.apiKey.invalidatedAt ? `Invalidated at ${selectedDetail.apiKey.invalidatedAt}` : "Active"}</Text>

            <Group align="end">
              <NumberInput label="Quota amount" min={1} max={1_000_000} value={quotaAmount} onChange={(value) => setQuotaAmount(Number(value) || 1)} />
              <TextInput label="Reason" value={quotaReason} onChange={(event) => setQuotaReason(event.currentTarget.value)} />
              <Button loading={loading} onClick={() => adjustQuota("grant")}>Add quota</Button>
              <Button color="orange" loading={loading} onClick={() => adjustQuota("remove")}>Remove quota</Button>
            </Group>

            <Group align="end">
              <TextInput label="Invalidation reason" value={invalidationReason} onChange={(event) => setInvalidationReason(event.currentTarget.value)} />
              <Button color="red" loading={loading} disabled={Boolean(selectedDetail.apiKey.invalidatedAt)} onClick={invalidateKey}>Invalidate</Button>
            </Group>

            <Title order={4}>Quota events</Title>
            {selectedDetail.quotaEvents.map((event) => (
              <Text key={event.id} size="sm">
                {event.createdAt}: {event.eventType} {event.amount} {event.reason ? `(${event.reason})` : ""}
              </Text>
            ))}

            <Title order={4}>Recent errors</Title>
            {selectedDetail.errors.length === 0 ? <Text c="dimmed">No errors.</Text> : null}
            {selectedDetail.errors.map((item) => (
              <Text key={item.id} size="sm" c="red">
                {item.createdAt}: {item.errorCode} — {item.errorMessage}
              </Text>
            ))}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
