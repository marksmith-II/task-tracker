export function formatDateTime(input: string): string {
  const d = new Date(input)
  if (!Number.isFinite(d.getTime())) return input

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

