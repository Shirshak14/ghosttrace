export function timeAgo(value) {
  if (!value) return '—'
  const d = new Date(value)
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export const nf = new Intl.NumberFormat()

export const TARGET_LABELS = {
  github_user: 'GitHub user',
  github_org: 'GitHub org',
  github_repo: 'GitHub repo',
  text: 'Pasted text',
  file: 'File upload',
  email: 'Email',
}
