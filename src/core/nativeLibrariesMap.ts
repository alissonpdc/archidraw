export const NATIVE_LIBRARY_ENTRIES = [
  ["Clients & Personas", "clients-personas.archidrawlib"],
  ["Infrastructure & Network", "infra-network.archidrawlib"],
  ["Compute & Services", "compute-services.archidrawlib"],
  ["Messaging & Integration", "messaging-integration.archidrawlib"],
  ["Data & Storage", "data-storage.archidrawlib"],
] as const;

export const NATIVE_LIBRARIES_MAP: Record<string, string> = {
  "Clients & Personas": "clients-personas.archidrawlib",
  "Infrastructure & Network": "infra-network.archidrawlib",
  "Compute & Services": "compute-services.archidrawlib",
  "Messaging & Integration": "messaging-integration.archidrawlib",
  "Data & Storage": "data-storage.archidrawlib",
};

export const NATIVE_LIBRARIES = NATIVE_LIBRARIES_MAP;
