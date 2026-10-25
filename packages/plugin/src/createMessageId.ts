/** Figma's opaque iframe has getRandomValues, but may not expose randomUUID. */
export function createMessageId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
