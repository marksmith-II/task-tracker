export function htmlToPlainText(input: string): string {
  const html = (input ?? '').trim()
  if (!html) return ''

  // Fast path: no tags/entities present.
  if (!/[<&]/.test(html)) return html

  // Prefer the browser's HTML parser when available (handles entities correctly).
  try {
    if (typeof document !== 'undefined') {
      const el = document.createElement('div')
      el.innerHTML = html
      const text = el.textContent ?? el.innerText ?? ''
      return text.replace(/\s+/g, ' ').trim()
    }
  } catch {
    // fall back to regex below
  }

  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
