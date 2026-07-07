import type { MantineColorScheme } from "@mantine/core";

export const colorSchemeCookieName = "wb-ai-helper-color-scheme";
export const colorSchemeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;
export const mantineColorSchemeStorageKey = "mantine-color-scheme-value";

export type StoredColorScheme = Extract<MantineColorScheme, "light" | "dark">;

export function isStoredColorScheme(value: unknown): value is StoredColorScheme {
  return value === "light" || value === "dark";
}

export function getStoredColorScheme(value: unknown): StoredColorScheme | null {
  return isStoredColorScheme(value) ? value : null;
}

export function setColorSchemeCookie(colorScheme: StoredColorScheme) {
  document.cookie = [
    `${colorSchemeCookieName}=${colorScheme}`,
    "Path=/",
    `Max-Age=${colorSchemeCookieMaxAgeSeconds}`,
    "SameSite=Lax",
  ].join("; ");
}

export function getColorSchemeBootstrapScript(defaultColorScheme: StoredColorScheme) {
  return `
try {
  var cookieName = ${JSON.stringify(colorSchemeCookieName)};
  var maxAge = ${JSON.stringify(colorSchemeCookieMaxAgeSeconds)};
  var storageKey = ${JSON.stringify(mantineColorSchemeStorageKey)};
  var fallbackColorScheme = ${JSON.stringify(defaultColorScheme)};
  var storedColorScheme = window.localStorage.getItem(storageKey);
  var colorScheme = storedColorScheme === "light" || storedColorScheme === "dark"
    ? storedColorScheme
    : fallbackColorScheme;

  document.documentElement.setAttribute("data-mantine-color-scheme", colorScheme);
  document.cookie = cookieName + "=" + colorScheme + "; Path=/; Max-Age=" + maxAge + "; SameSite=Lax";
} catch (error) {}
`;
}
