import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...props }) {
  const variants = {
    primary: 'bg-cyan text-ink-950 hover:bg-cyan-500 font-semibold shadow-glow',
    secondary: 'border border-ink-600 bg-ink-800/70 text-ink-100 hover:border-ink-500 hover:bg-ink-700/70',
    ghost: 'text-ink-300 hover:bg-ink-800 hover:text-white',
    danger: 'border border-sev-critical/40 bg-sev-critical/10 text-sev-critical hover:bg-sev-critical/20',
  }
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant], sizes[size], className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className, children, ...props }) {
  return <div className={clsx('card', className)} {...props}>{children}</div>
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-800 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const SEV_STYLES = {
  critical: 'bg-sev-critical/15 text-sev-critical ring-sev-critical/30',
  high: 'bg-sev-high/15 text-sev-high ring-sev-high/30',
  medium: 'bg-sev-medium/15 text-sev-medium ring-sev-medium/30',
  low: 'bg-sev-low/15 text-sev-low ring-sev-low/30',
}

export function SeverityBadge({ severity }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium uppercase ring-1 ring-inset', SEV_STYLES[severity] || SEV_STYLES.low)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {severity}
    </span>
  )
}

const STATUS_STYLES = {
  completed: 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/25',
  running: 'text-cyan bg-cyan/10 ring-cyan/25',
  queued: 'text-ink-300 bg-ink-700/40 ring-ink-600',
  failed: 'text-sev-critical bg-sev-critical/10 ring-sev-critical/25',
  open: 'text-sev-high bg-sev-high/10 ring-sev-high/25',
  resolved: 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/25',
  false_positive: 'text-ink-300 bg-ink-700/40 ring-ink-600',
  sent: 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/25',
  skipped: 'text-ink-300 bg-ink-700/40 ring-ink-600',
}

export function StatusBadge({ status }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset', STATUS_STYLES[status] || STATUS_STYLES.queued)}>
      {status === 'running' && <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-current" />}
      {String(status).replace('_', ' ')}
    </span>
  )
}

export function Spinner({ className }) {
  return <Loader2 className={clsx('animate-spin text-cyan', className || 'h-5 w-5')} />
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 rounded-xl border border-ink-700 bg-ink-850 p-3">
          <Icon className="h-6 w-6 text-cyan" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-400">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-300">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs text-sev-critical">{error}</span>}
    </label>
  )
}

export function RiskMeter({ value }) {
  const v = Math.round(value || 0)
  const color = v >= 80 ? '#ff4d6d' : v >= 60 ? '#ff8a3d' : v >= 35 ? '#f5c84c' : '#4cc9f0'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-ink-200">{v}</span>
    </div>
  )
}
