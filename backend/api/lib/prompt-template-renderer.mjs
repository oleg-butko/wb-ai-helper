import { allowedPromptTemplateKeys } from "../../src/shared/api/admin-ai-prompt-profiles.mjs";

const placeholderPattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const allowedKeys = new Set(allowedPromptTemplateKeys);

function formatValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "—";
    }

    return value.map((item) => `- ${String(item || "—")}`).join("\n");
  }

  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

export function findUnknownPromptPlaceholders(template) {
  const unknown = new Set();

  for (const match of template.matchAll(placeholderPattern)) {
    const key = match[1];

    if (!allowedKeys.has(key)) {
      unknown.add(key);
    }
  }

  return Array.from(unknown).sort();
}

export function renderProductDetailsPrompt({ template, payload }) {
  const unknownPlaceholders = findUnknownPromptPlaceholders(template);

  if (unknownPlaceholders.length > 0) {
    const error = new Error("The product details template contains unknown placeholders.");
    error.code = "admin_ai_prompt_profile_unknown_placeholders";
    error.details = { unknownPlaceholders };
    throw error;
  }

  return template.replace(placeholderPattern, (_match, key) => formatValue(payload[key]));
}
