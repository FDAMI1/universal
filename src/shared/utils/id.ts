export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older Hermes).
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
