import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function formatLocalTimestamp(date) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function sanitizeFilePart(value, fallback) {
  const sanitized = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  return sanitized || fallback;
}

async function writeFormattedJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function createProviderJsonLogger({
  operation,
  providerProfileId,
  correlationId,
  onError = () => {},
  now = () => new Date(),
  callId = randomUUID(),
} = {}) {
  const sessionDirectory = process.env.WB_AI_HELPER_LOG_DIR;

  if (!sessionDirectory) {
    return {
      callId,
      requestFileName: null,
      async writeRequest() {},
      async writeResponse() {},
    };
  }

  const startedAt = now();
  const operationPart = sanitizeFilePart(operation, "provider-call");
  const correlationPart = sanitizeFilePart(correlationId ?? providerProfileId, "uncorrelated");
  const callPart = sanitizeFilePart(callId, "call");
  const stem = `${formatLocalTimestamp(startedAt)}_${operationPart}_${correlationPart}_${callPart}`;
  const outputDirectory = path.join(sessionDirectory, "openai");
  const requestFileName = `${stem}.request.json`;
  const responseFileName = `${stem}.response.json`;

  async function safelyWrite(fileName, payload) {
    try {
      await mkdir(outputDirectory, { recursive: true });
      await writeFormattedJson(path.join(outputDirectory, fileName), payload);
    } catch (error) {
      onError(error);
    }
  }

  return {
    callId,
    requestFileName,
    async writeRequest({ method, url, body }) {
      await safelyWrite(requestFileName, {
        callId,
        operation,
        providerProfileId: providerProfileId ?? null,
        correlationId: correlationId ?? null,
        startedAt: startedAt.toISOString(),
        method,
        url: url.toString(),
        body: body ?? null,
      });
    },
    async writeResponse({ status, ok, body, rawBody, error }) {
      const completedAt = now();
      await safelyWrite(responseFileName, {
        callId,
        operation,
        providerProfileId: providerProfileId ?? null,
        correlationId: correlationId ?? null,
        requestFile: requestFileName,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        status: status ?? null,
        ok: ok ?? false,
        body: body ?? null,
        ...(rawBody === undefined ? {} : { rawBody }),
        ...(error
          ? {
              error: {
                name: error.name ?? "Error",
                message: error.message ?? String(error),
                code: error.code ?? null,
              },
            }
          : {}),
      });
    },
  };
}
