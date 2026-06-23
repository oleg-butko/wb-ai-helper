"use client";

import { Alert, Badge, Button, Card, CopyButton, Group, NumberInput, Select, Stack, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [invalidationConfirm, setInvalidationConfirm] = useState("");
  const [listFilter, setListFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "invalidated">("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pageSize = 10;

  const filteredApiKeys = useMemo(() => {
    const normalizedFilter = listFilter.trim().toLowerCase();

    return apiKeys.filter((apiKey) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !apiKey.invalidatedAt) ||
        (statusFilter === "invalidated" && Boolean(apiKey.invalidatedAt));
      const searchableText = `${apiKey.id} ${apiKey.label ?? ""}`.toLowerCase();
      const matchesText = !normalizedFilter || searchableText.includes(normalizedFilter);

      return matchesStatus && matchesText;
    });
  }, [apiKeys, listFilter, statusFilter]);

  const pageCount = Math.max(Math.ceil(filteredApiKeys.length / pageSize), 1);
  const currentPage = Math.min(page, pageCount);
  const pagedApiKeys = filteredApiKeys.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const refreshList = useCallback(async () => {
    const response = await fetch("/api/admin/extension-api-keys?limit=50", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message ?? "Could not load API keys.");
    }

    setApiKeys(payload.apiKeys ?? []);
    setPage(1);
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
      setQuota(10);
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

    if (invalidationConfirm !== selectedDetail.apiKey.id) {
      setError("Paste the selected API key id into the confirmation field before invalidating.");
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
      setInvalidationConfirm("");
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
          <Group grow align="end">
            <TextInput
              label="Filter by label or id"
              value={listFilter}
              onChange={(event) => {
                setListFilter(event.currentTarget.value);
                setPage(1);
              }}
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value === "active" || value === "invalidated" ? value : "all");
                setPage(1);
              }}
              data={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "invalidated", label: "Invalidated" },
              ]}
            />
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
                {pagedApiKeys.map((apiKey) => (
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
          {filteredApiKeys.length === 0 ? <Text c="dimmed">No API keys match the current filters.</Text> : null}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {pagedApiKeys.length} of {filteredApiKeys.length} filtered keys ({apiKeys.length} loaded)
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
              >
                Previous
              </Button>
              <Text size="sm">
                Page {currentPage} / {pageCount}
              </Text>
              <Button
                size="xs"
                variant="light"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((value) => Math.min(value + 1, pageCount))}
              >
                Next
              </Button>
            </Group>
          </Group>
        </Stack>
      </Card>

      {selectedDetail ? (
        <Card withBorder radius="lg" p="lg">
          <Stack gap="md">
            <Title order={3}>Selected key</Title>
            <Text>ID: <code>{selectedDetail.apiKey.id}</code></Text>
            <Group gap="sm">
              <Badge color={selectedDetail.apiKey.invalidatedAt ? "red" : "green"}>
                {selectedDetail.apiKey.invalidatedAt ? "invalidated" : "active"}
              </Badge>
              <Text size="sm">
                Quota: {selectedDetail.apiKey.quotaUsed} used / {selectedDetail.apiKey.quotaTotal} total / {selectedDetail.apiKey.quotaRemaining} remaining
              </Text>
            </Group>
            {selectedDetail.apiKey.invalidatedAt ? (
              <Text c="red" size="sm">
                Invalidated at {selectedDetail.apiKey.invalidatedAt}
                {selectedDetail.apiKey.invalidationReason ? ` (${selectedDetail.apiKey.invalidationReason})` : ""}
              </Text>
            ) : null}

            <Group align="end">
              <NumberInput label="Quota amount" min={1} max={1_000_000} value={quotaAmount} onChange={(value) => setQuotaAmount(Number(value) || 1)} />
              <TextInput label="Reason" value={quotaReason} onChange={(event) => setQuotaReason(event.currentTarget.value)} />
              <Button loading={loading} onClick={() => adjustQuota("grant")}>Add quota</Button>
              <Button color="orange" loading={loading} onClick={() => adjustQuota("remove")}>Remove quota</Button>
            </Group>

            <Stack gap="xs">
              <TextInput label="Invalidation reason" value={invalidationReason} onChange={(event) => setInvalidationReason(event.currentTarget.value)} />
              <TextInput
                label="Paste API key id to confirm invalidation"
                value={invalidationConfirm}
                onChange={(event) => setInvalidationConfirm(event.currentTarget.value)}
              />
              <Button
                color="red"
                loading={loading}
                disabled={Boolean(selectedDetail.apiKey.invalidatedAt)}
                onClick={invalidateKey}
              >
                Invalidate
              </Button>
            </Stack>

            <Title order={4}>Quota events</Title>
            {selectedDetail.quotaEvents.length === 0 ? <Text c="dimmed">No quota events.</Text> : null}
            {selectedDetail.quotaEvents.map((event) => (
              <Text key={event.id} size="sm">
                {event.createdAt}: {event.eventType} {event.amount} {event.reason ? `(${event.reason})` : ""}
              </Text>
            ))}

            <Title order={4}>Extension users</Title>
            {selectedDetail.users.length === 0 ? <Text c="dimmed">No extension users have used this key.</Text> : null}
            {selectedDetail.users.length > 0 ? (
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>User ID</Table.Th>
                      <Table.Th>First seen</Table.Th>
                      <Table.Th>Last seen</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedDetail.users.map((user) => (
                      <Table.Tr key={user.extensionUserId}>
                        <Table.Td><code>{user.extensionUserId}</code></Table.Td>
                        <Table.Td>{user.firstSeenAt}</Table.Td>
                        <Table.Td>{user.lastSeenAt ?? "—"}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : null}

            <Title order={4}>Generation requests</Title>
            {selectedDetail.requests.length === 0 ? <Text c="dimmed">No generation requests.</Text> : null}
            {selectedDetail.requests.length > 0 ? (
              <Table.ScrollContainer minWidth={720}>
                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Created</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Quota</Table.Th>
                      <Table.Th>User ID</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedDetail.requests.map((request) => (
                      <Table.Tr key={request.id}>
                        <Table.Td>{request.createdAt}</Table.Td>
                        <Table.Td>
                          <Badge color={request.status === "succeeded" ? "green" : request.status === "failed" ? "red" : "gray"}>
                            {request.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{request.quotaConsumed ? "consumed" : "not consumed"}</Table.Td>
                        <Table.Td><code>{request.extensionUserId}</code></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : null}

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
