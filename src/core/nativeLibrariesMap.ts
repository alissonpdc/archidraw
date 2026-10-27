export const NATIVE_LIBRARY_ENTRIES = [
  ["Clients & Devices", "clients-devices.archidrawlib"],
  ["Infrastructure & Network", "infra-network.archidrawlib"],
  ["Compute & Services", "compute-services.archidrawlib"],
  ["Data & Storage", "data-storage.archidrawlib"],
  ["Messaging & Events", "messaging-events.archidrawlib"],
  ["Security & Identity", "security-identity.archidrawlib"],
  ["Observability & Operations", "observability-ops.archidrawlib"],
  ["Platform & Integrations", "platform-integrations.archidrawlib"],
] as const;

export const NATIVE_LIBRARIES_MAP: Record<string, string> = {
  "Clients & Devices": "clients-devices.archidrawlib",
  "Infrastructure & Network": "infra-network.archidrawlib",
  "Compute & Services": "compute-services.archidrawlib",
  "Data & Storage": "data-storage.archidrawlib",
  "Messaging & Events": "messaging-events.archidrawlib",
  "Security & Identity": "security-identity.archidrawlib",
  "Observability & Operations": "observability-ops.archidrawlib",
  "Platform & Integrations": "platform-integrations.archidrawlib",
};

export const NATIVE_LIBRARIES = NATIVE_LIBRARIES_MAP;
