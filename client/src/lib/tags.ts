const PALETTE = [
  'bg-slate-100 text-slate-800 ring-slate-200',
  'bg-zinc-100 text-zinc-800 ring-zinc-200',
  'bg-sky-100 text-sky-800 ring-sky-200',
  'bg-indigo-100 text-indigo-800 ring-indigo-200',
  'bg-emerald-100 text-emerald-800 ring-emerald-200',
  'bg-amber-100 text-amber-900 ring-amber-200',
  'bg-rose-100 text-rose-800 ring-rose-200',
  'bg-violet-100 text-violet-800 ring-violet-200',
] as const

function hashString(input: string) {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
}

export function tagBadgeClasses(tag: string) {
  const idx = hashString(tag.trim().toLowerCase()) % PALETTE.length
  return PALETTE[idx]
}

