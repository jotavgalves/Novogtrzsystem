export function requireOperationReason(reason: string): string {
  const normalized = reason.trim();

  if (normalized.length < 3) {
    throw new Error('Informe uma justificativa com pelo menos 3 caracteres.');
  }

  if (normalized.length > 240) {
    throw new Error('A justificativa deve ter no máximo 240 caracteres.');
  }

  return normalized;
}
