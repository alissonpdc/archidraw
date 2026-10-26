/** 32-bit FNV-1a, used only when WebCrypto is unavailable (non-secure contexts) */
function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Content hash used to detect local/disk divergence.
 * Returns a hex digest with a prefix that identifies the algorithm.
 * Example: await hashText("abc") // "sha256:ba7816bf..."
 */
export async function hashText(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return `fnv1a:${fnv1aHex(text)}`;
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}
