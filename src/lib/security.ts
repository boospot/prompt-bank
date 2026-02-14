const MAX_AUDIT_METADATA_LENGTH = 2000;

export function sanitizeAuditMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata) {
    return null;
  }

  const entries = Object.entries(metadata)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, value === undefined ? null : value] as const);

  const serialized = JSON.stringify(Object.fromEntries(entries));
  if (serialized.length <= MAX_AUDIT_METADATA_LENGTH) {
    return serialized;
  }

  return `${serialized.slice(0, MAX_AUDIT_METADATA_LENGTH)}...[truncated]`;
}

export function isStrongPassword(password: string): boolean {
  if (password.length < 12 || password.length > 128) {
    return false;
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return hasLower && hasUpper && hasNumber && hasSymbol;
}
