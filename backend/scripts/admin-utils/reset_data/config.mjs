import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../",
);

export default {
  projectRoot,
  defaultEnvProfile: "e2e",
  envProfiles: {
    e2e: [".env.api.e2e.local", ".env.e2e.local"],
    dev: [".env.api.local", ".env.local"],
    prod: [".env.api.prod.local", ".env.prod.local"],
  },
  useSqlFiles: [
    "docs/SQL/reset-supabase-full.sql",
    "docs/SQL/bootstrap-supabase-initial.sql",
  ],
  sql: {
    enabled: true,
    required: false,
    method: "auto",
    rpcName: "exec_sql",
    rpcSqlArgument: "sql",
    metaPath: "/pg/meta/query",
  },
  dataReset: {
    enabled: true,
    publicTables: [
      "extension_errors",
      "extension_generation_events",
      "extension_generation_requests",
      { name: "extension_api_key_users", deleteColumn: "api_key_id" },
      { name: "extension_users", deleteColumn: "user_id" },
      "extension_api_key_quota_events",
      "extension_api_keys",
      "ai_prompt_profiles",
      "ai_provider_profiles",
      { name: "admins", deleteColumn: "email" },
      "workspace_module_roles",
      "workspace_files",
      "workspace_memberships",
      "workspaces",
      "user_module_roles",
      "profiles",
    ],
  },
  storage: {
    enabled: true,
    bucketsFromEnv: ["STORAGE_S3_BUCKET"],
    listPageSize: 100,
  },
  redis: {
    enabled: true,
    mode: "flushdb",
  },
  logFile: "last-run.json",
};
