export function formatAppVersion(raw?: string): string {
  if (!raw || raw.trim() === "") {
    return "v0.0.0";
  }
  return raw.startsWith("v") ? raw : `v${raw}`;
}

export function getAppVersion(): string {
  return formatAppVersion(import.meta.env.VITE_APP_VERSION);
}
