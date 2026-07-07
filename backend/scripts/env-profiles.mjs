import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFiles, readEnvFile } from "./load-env.mjs";

export const runtimeEnvProfiles = {
  dev: [".env.api.local", ".env.local"],
  e2e: [".env.api.e2e.local", ".env.e2e.local"],
  prod: [".env.api.prod.local", ".env.prod.local"],
};

export const defaultRuntimeEnvProfile = "dev";

export function getProjectRootFromScript(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..");
}

export function normalizeRuntimeEnvProfile(profile = process.env.WB_AI_HELPER_ENV) {
  const normalizedProfile = profile?.trim() || defaultRuntimeEnvProfile;

  if (!Object.hasOwn(runtimeEnvProfiles, normalizedProfile)) {
    throw new Error(
      `Unsupported WB_AI_HELPER_ENV="${normalizedProfile}". Expected one of: ${Object.keys(runtimeEnvProfiles).join(", ")}.`,
    );
  }

  return normalizedProfile;
}

export function resolveRuntimeEnvFiles({
  profile = process.env.WB_AI_HELPER_ENV,
  projectRoot = process.cwd(),
} = {}) {
  const normalizedProfile = normalizeRuntimeEnvProfile(profile);

  return {
    profile: normalizedProfile,
    envFiles: runtimeEnvProfiles[normalizedProfile].map((file) => ({
      relativePath: file,
      absolutePath: path.resolve(projectRoot, file),
    })),
  };
}

export function loadRuntimeEnv({
  profile = process.env.WB_AI_HELPER_ENV,
  projectRoot = process.cwd(),
  override = false,
  requireFiles,
} = {}) {
  const resolved = resolveRuntimeEnvFiles({ profile, projectRoot });
  const shouldRequireFiles = requireFiles ?? resolved.profile === "prod";
  const missingFiles = resolved.envFiles.filter((file) => !existsSync(file.absolutePath));

  if (shouldRequireFiles && missingFiles.length > 0) {
    throw new Error(
      `Missing ${resolved.profile} env file(s): ${missingFiles.map((file) => file.relativePath).join(", ")}.`,
    );
  }

  loadEnvFiles(resolved.envFiles.map((file) => file.absolutePath), { override });
  process.env.WB_AI_HELPER_ENV = resolved.profile;

  return {
    profile: resolved.profile,
    envFiles: resolved.envFiles,
    missingFiles,
  };
}

export function readRuntimeEnvProfile({
  profile,
  projectRoot = process.cwd(),
} = {}) {
  const resolved = resolveRuntimeEnvFiles({ profile, projectRoot });
  const values = {};

  for (const file of resolved.envFiles) {
    Object.assign(values, readEnvFile(file.absolutePath));
  }

  return {
    profile: resolved.profile,
    envFiles: resolved.envFiles,
    values,
  };
}

function getPortFromSiteUrl(siteUrl) {
  if (!siteUrl) {
    return undefined;
  }

  try {
    const url = new URL(siteUrl);
    return url.port || (url.protocol === "https:" ? "443" : "80");
  } catch {
    return undefined;
  }
}

function getWebPort(values) {
  return values.PORT ?? getPortFromSiteUrl(values.NEXT_PUBLIC_SITE_URL) ?? "3000";
}

export function getProdIsolationWarnings({
  projectRoot = process.cwd(),
} = {}) {
  const warnings = [];
  const dev = readRuntimeEnvProfile({ profile: "dev", projectRoot });
  const prod = readRuntimeEnvProfile({ profile: "prod", projectRoot });
  const missingProdFiles = prod.envFiles.filter((file) => !existsSync(file.absolutePath));

  if (missingProdFiles.length > 0) {
    warnings.push(
      `Prod env file(s) are missing: ${missingProdFiles.map((file) => file.relativePath).join(", ")}.`,
    );
    return warnings;
  }

  if (prod.values.API_PORT && dev.values.API_PORT && prod.values.API_PORT === dev.values.API_PORT) {
    warnings.push(`Prod API_PORT matches dev API_PORT (${prod.values.API_PORT}).`);
  }

  const devWebPort = getWebPort(dev.values);
  const prodWebPort = getWebPort(prod.values);

  if (prodWebPort && devWebPort && prodWebPort === devWebPort) {
    warnings.push(`Prod web port matches dev web port (${prodWebPort}).`);
  }

  if (
    prod.values.STORAGE_S3_BUCKET &&
    dev.values.STORAGE_S3_BUCKET &&
    prod.values.STORAGE_S3_BUCKET === dev.values.STORAGE_S3_BUCKET
  ) {
    warnings.push(`Prod STORAGE_S3_BUCKET matches dev STORAGE_S3_BUCKET (${prod.values.STORAGE_S3_BUCKET}).`);
  }

  if (
    prod.values.NEXT_PUBLIC_SITE_URL &&
    dev.values.NEXT_PUBLIC_SITE_URL &&
    prod.values.NEXT_PUBLIC_SITE_URL === dev.values.NEXT_PUBLIC_SITE_URL
  ) {
    warnings.push("Prod NEXT_PUBLIC_SITE_URL matches dev NEXT_PUBLIC_SITE_URL.");
  }

  return warnings;
}
