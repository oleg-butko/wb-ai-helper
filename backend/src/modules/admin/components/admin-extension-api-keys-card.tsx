"use client";

import { Alert, Badge, Button, Card, Group, Loader, NumberInput, Select, Stack, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import type {
  AdminExtensionApiKeyDetailResponse,
  AdminExtensionApiKeyListResponse,
  CreateAdminExtensionApiKeyResponse,
} from "@/shared/api/admin-extension-api-keys";
import type { SiteDictionary } from "@/lib/i18n/dictionaries";

type ApiKeySummary = AdminExtensionApiKeyListResponse["apiKeys"][number];
type ApiKeyDetail = AdminExtensionApiKeyDetailResponse["result"];
type AdminApiKeysDictionary = SiteDictionary["app"]["adminApiKeys"];

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

function formatMessage(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall back for non-secure origins such as local HTTP hostnames.
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

type AdminExtensionApiKeysCardProps = {
  dictionary: AdminApiKeysDictionary;
};

export function AdminExtensionApiKeysCard({ dictionary }: AdminExtensionApiKeysCardProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ApiKeyDetail | null>(null);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [quota, setQuota] = useState(10);
  const [searchKey, setSearchKey] = useState("");
  const [listFilterInput, setListFilterInput] = useState("");
  const [appliedListFilter, setAppliedListFilter] = useState("");
  const [isFilterPending, setIsFilterPending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "invalidated">("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pageSize = 10;

  const filteredApiKeys = useMemo(() => {
    const normalizedFilter = appliedListFilter.trim().toLowerCase();

    return apiKeys.filter((apiKey) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !apiKey.invalidatedAt) ||
        (statusFilter === "invalidated" && Boolean(apiKey.invalidatedAt));
      const searchableText = `${apiKey.id} ${apiKey.label ?? ""}`.toLowerCase();
      const matchesText = !normalizedFilter || searchableText.includes(normalizedFilter);

      return matchesStatus && matchesText;
    });
  }, [apiKeys, appliedListFilter, statusFilter]);

  const pageCount = Math.max(Math.ceil(filteredApiKeys.length / pageSize), 1);
  const currentPage = Math.min(page, pageCount);
  const pagedApiKeys = filteredApiKeys.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (listFilterInput === appliedListFilter) {
      setIsFilterPending(false);
      return undefined;
    }

    setIsFilterPending(true);
    const timeout = window.setTimeout(() => {
      setAppliedListFilter(listFilterInput);
      setPage(1);
      setIsFilterPending(false);
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [appliedListFilter, listFilterInput]);

  const refreshList = useCallback(async () => {
    const response = await fetch("/api/admin/extension-api-keys?limit=50", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message ?? dictionary.loadKeysFailed);
    }

    setApiKeys(payload.apiKeys ?? []);
    setPage(1);
  }, [dictionary.loadKeysFailed]);

  useEffect(() => {
    refreshList().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : dictionary.loadKeysFailed);
    });
  }, [dictionary.loadKeysFailed, refreshList]);

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
          reason: dictionary.initialQuotaReason,
        }),
      });
      const payload = (await response.json().catch(() => null)) as CreateAdminExtensionApiKeyResponse | unknown;

      if (!response.ok || !isCreateApiKeyResponse(payload)) {
        throw new Error(getPayloadMessage(payload) ?? dictionary.createFailed);
      }

      setCreatedRawKey(payload.rawApiKey);
      setFeedback(dictionary.createdCopyNotice);
      setLabel("");
      setQuota(10);
      await refreshList();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : dictionary.createFailed);
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
        throw new Error(payload?.message ?? dictionary.detailFailed);
      }

      setSelectedDetail(payload.result);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : dictionary.detailFailed);
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
        throw new Error(payload?.message ?? dictionary.findFailed);
      }

      setSelectedDetail(payload.result);
      setFeedback(payload.result ? dictionary.found : dictionary.notFound);
    } catch (findError) {
      setError(findError instanceof Error ? findError.message : dictionary.findFailed);
    } finally {
      setLoading(false);
    }
  }

  async function adjustQuota(direction: "grant" | "remove", amount: number, reason: string) {
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
          amount,
          reason: reason || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? dictionary.quotaUpdateFailed);
      }

      setFeedback(dictionary.quotaUpdated);
      await refreshList();
      await loadDetail(payload.apiKey.id);
    } catch (quotaError) {
      setError(quotaError instanceof Error ? quotaError.message : dictionary.quotaUpdateFailed);
    } finally {
      setLoading(false);
    }
  }

  async function invalidateKey({ confirmId, reason }: { confirmId: string; reason: string }) {
    if (!selectedDetail) {
      return;
    }

    if (confirmId !== selectedDetail.apiKey.id) {
      setError(dictionary.invalidationConfirmError);
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
          reason: reason || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? dictionary.invalidateFailed);
      }

      setFeedback(dictionary.invalidated);
      await refreshList();
      await loadDetail(payload.apiKey.id);
    } catch (invalidateError) {
      setError(invalidateError instanceof Error ? invalidateError.message : dictionary.invalidateFailed);
    } finally {
      setLoading(false);
    }
  }

  async function copyCreatedApiKey() {
    if (!createdRawKey) {
      return;
    }

    setError(null);
    const copied = await copyTextToClipboard(createdRawKey);

    if (copied) {
      setFeedback(dictionary.copied);
      return;
    }

    setError("Could not copy API key. Select it manually and copy it from the page.");
  }

  return (
    <Stack gap="lg">
      {error ? <Alert color="red">{error}</Alert> : null}
      {feedback ? <Alert color="green">{feedback}</Alert> : null}
      {createdRawKey ? (
        <Alert color="yellow">
          <Group justify="space-between" align="center">
            <Text>
              {dictionary.rawApiKeyLabel}: <code>{createdRawKey}</code>
            </Text>
            <Button size="xs" onClick={copyCreatedApiKey}>
              {dictionary.copy}
            </Button>
          </Group>
        </Alert>
      ) : null}

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>{dictionary.createTitle}</Title>
          <TextInput label={dictionary.labelLabel} value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
          <NumberInput label={dictionary.initialQuotaLabel} min={0} max={1_000_000} value={quota} onChange={(value) => setQuota(Number(value) || 0)} />
          <Button loading={loading} onClick={createApiKey}>{dictionary.createSubmit}</Button>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>{dictionary.findTitle}</Title>
          <Textarea label={dictionary.rawApiKeyInputLabel} value={searchKey} onChange={(event) => setSearchKey(event.currentTarget.value)} />
          <Button loading={loading} onClick={findByValue}>{dictionary.findSubmit}</Button>
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>{dictionary.recentTitle}</Title>
            <Button variant="light" loading={loading} onClick={() => refreshList()}>{dictionary.refresh}</Button>
          </Group>
          <Group grow align="end">
            <TextInput
              label={dictionary.filterLabel}
              value={listFilterInput}
              rightSection={isFilterPending ? <Loader size="xs" /> : null}
              onChange={(event) => {
                setListFilterInput(event.currentTarget.value);
              }}
            />
            <Select
              label={dictionary.statusLabel}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value === "active" || value === "invalidated" ? value : "all");
                setPage(1);
              }}
              data={[
                { value: "all", label: dictionary.statusAll },
                { value: "active", label: dictionary.statusActive },
                { value: "invalidated", label: dictionary.statusInvalidated },
              ]}
            />
          </Group>
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{dictionary.columnLabel}</Table.Th>
                  <Table.Th>{dictionary.columnStatus}</Table.Th>
                  <Table.Th>{dictionary.columnQuota}</Table.Th>
                  <Table.Th>{dictionary.columnCreated}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pagedApiKeys.map((apiKey) => (
                  <Table.Tr key={apiKey.id}>
                    <Table.Td>{apiKey.label ?? apiKey.id}</Table.Td>
                    <Table.Td>
                      <Badge color={apiKey.invalidatedAt ? "red" : "green"}>
                        {apiKey.invalidatedAt ? dictionary.statusInvalidated : dictionary.statusActive}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{apiKey.quotaUsed} / {apiKey.quotaTotal}</Table.Td>
                    <Table.Td>{apiKey.createdAt ?? "—"}</Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="light" loading={loading} onClick={() => loadDetail(apiKey.id)}>{dictionary.open}</Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {filteredApiKeys.length === 0 ? <Text c="dimmed">{dictionary.noMatches}</Text> : null}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {formatMessage(dictionary.showingSummary, {
                shown: pagedApiKeys.length,
                filtered: filteredApiKeys.length,
                loaded: apiKeys.length,
              })}
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
              >
                {dictionary.previous}
              </Button>
              <Text size="sm">
                {formatMessage(dictionary.pageSummary, { page: currentPage, pageCount })}
              </Text>
              <Button
                size="xs"
                variant="light"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((value) => Math.min(value + 1, pageCount))}
              >
                {dictionary.next}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Card>

      {selectedDetail ? (
        <Card withBorder radius="lg" p="lg">
          <Stack gap="md">
            <Title order={3}>{dictionary.selectedTitle}</Title>
            <Text>{dictionary.idLabel}: <code>{selectedDetail.apiKey.id}</code></Text>
            <Group gap="sm">
              <Badge color={selectedDetail.apiKey.invalidatedAt ? "red" : "green"}>
                {selectedDetail.apiKey.invalidatedAt ? dictionary.statusInvalidated : dictionary.statusActive}
              </Badge>
              <Text size="sm">
                {formatMessage(dictionary.quotaSummary, {
                  used: selectedDetail.apiKey.quotaUsed,
                  total: selectedDetail.apiKey.quotaTotal,
                  remaining: selectedDetail.apiKey.quotaRemaining,
                })}
              </Text>
            </Group>
            {selectedDetail.apiKey.invalidatedAt ? (
              <Text c="red" size="sm">
                {formatMessage(dictionary.invalidatedAt, { date: selectedDetail.apiKey.invalidatedAt })}
                {selectedDetail.apiKey.invalidationReason ? ` (${selectedDetail.apiKey.invalidationReason})` : ""}
              </Text>
            ) : null}

            <Group align="end">
              <QuotaControls
                dictionary={dictionary}
                loading={loading}
                onAdjustQuota={adjustQuota}
              />
            </Group>

            <InvalidationControls
              dictionary={dictionary}
              disabled={Boolean(selectedDetail.apiKey.invalidatedAt)}
              loading={loading}
              onInvalidate={invalidateKey}
            />

            <Title order={4}>{dictionary.quotaEventsTitle}</Title>
            {selectedDetail.quotaEvents.length === 0 ? <Text c="dimmed">{dictionary.noQuotaEvents}</Text> : null}
            {selectedDetail.quotaEvents.map((event) => (
              <Text key={event.id} size="sm">
                {event.createdAt}: {event.eventType} {event.amount} {event.reason ? `(${event.reason})` : ""}
              </Text>
            ))}

            <Title order={4}>{dictionary.extensionUsersTitle}</Title>
            {selectedDetail.users.length === 0 ? <Text c="dimmed">{dictionary.noExtensionUsers}</Text> : null}
            {selectedDetail.users.length > 0 ? (
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{dictionary.userIdColumn}</Table.Th>
                      <Table.Th>{dictionary.firstSeenColumn}</Table.Th>
                      <Table.Th>{dictionary.lastSeenColumn}</Table.Th>
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

            <Title order={4}>{dictionary.generationRequestsTitle}</Title>
            {selectedDetail.requests.length === 0 ? <Text c="dimmed">{dictionary.noGenerationRequests}</Text> : null}
            {selectedDetail.requests.length > 0 ? (
              <Table.ScrollContainer minWidth={720}>
                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{dictionary.columnCreated}</Table.Th>
                      <Table.Th>{dictionary.statusColumn}</Table.Th>
                      <Table.Th>{dictionary.columnQuota}</Table.Th>
                      <Table.Th>{dictionary.userIdColumn}</Table.Th>
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
                        <Table.Td>{request.quotaConsumed ? dictionary.quotaConsumed : dictionary.quotaNotConsumed}</Table.Td>
                        <Table.Td><code>{request.extensionUserId}</code></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : null}

            <Title order={4}>{dictionary.recentErrorsTitle}</Title>
            {selectedDetail.errors.length === 0 ? <Text c="dimmed">{dictionary.noErrors}</Text> : null}
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

const QuotaControls = memo(function QuotaControls({
  dictionary,
  loading,
  onAdjustQuota,
}: {
  dictionary: AdminApiKeysDictionary;
  loading: boolean;
  onAdjustQuota: (direction: "grant" | "remove", amount: number, reason: string) => void;
}) {
  const [quotaAmount, setQuotaAmount] = useState(10);
  const [quotaReason, setQuotaReason] = useState("");

  return (
    <>
      <NumberInput
        label={dictionary.quotaAmountLabel}
        min={1}
        max={1_000_000}
        value={quotaAmount}
        onChange={(value) => setQuotaAmount(Number(value) || 1)}
      />
      <TextInput
        label={dictionary.reasonLabel}
        value={quotaReason}
        onChange={(event) => setQuotaReason(event.currentTarget.value)}
      />
      <Button loading={loading} onClick={() => onAdjustQuota("grant", quotaAmount, quotaReason)}>
        {dictionary.addQuota}
      </Button>
      <Button color="orange" loading={loading} onClick={() => onAdjustQuota("remove", quotaAmount, quotaReason)}>
        {dictionary.removeQuota}
      </Button>
    </>
  );
});

const InvalidationControls = memo(function InvalidationControls({
  dictionary,
  disabled,
  loading,
  onInvalidate,
}: {
  dictionary: AdminApiKeysDictionary;
  disabled: boolean;
  loading: boolean;
  onInvalidate: (payload: { confirmId: string; reason: string }) => void;
}) {
  const [invalidationReason, setInvalidationReason] = useState("");
  const [invalidationConfirm, setInvalidationConfirm] = useState("");

  return (
    <Stack gap="xs">
      <TextInput
        label={dictionary.invalidationReasonLabel}
        value={invalidationReason}
        onChange={(event) => setInvalidationReason(event.currentTarget.value)}
      />
      <TextInput
        label={dictionary.invalidationConfirmLabel}
        value={invalidationConfirm}
        onChange={(event) => setInvalidationConfirm(event.currentTarget.value)}
      />
      <Button
        color="red"
        loading={loading}
        disabled={disabled}
        onClick={() => onInvalidate({
          confirmId: invalidationConfirm,
          reason: invalidationReason,
        })}
      >
        {dictionary.invalidate}
      </Button>
    </Stack>
  );
});
