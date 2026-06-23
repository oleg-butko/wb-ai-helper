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

export function createE2EWebEnv(baseEnv) {
  const webEnv = { ...baseEnv };

  const resolvedPort =
    webEnv.PORT ??
    getPortFromSiteUrl(webEnv.NEXT_PUBLIC_SITE_URL) ??
    webEnv.API_PORT;

  if (resolvedPort) {
    webEnv.PORT = resolvedPort;
  }

  return webEnv;
}
