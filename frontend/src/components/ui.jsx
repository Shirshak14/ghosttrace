import { useEffect, useId } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { SPRING, SPRING_SOFT } from '../lib/motion'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronRight, Loader2, X } from 'lucide-react'

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...props }) {
  const variants = {
    primary: 'bg-white text-black hover:bg-[#e6e6e6] active:bg-[#d4d4d4]',
    secondary: 'bg-[#2c2c2c] text-white hover:bg-[#383838] active:bg-[#444]',
    gray: 'bg-[#1e1e1e] text-white hover:bg-[#2a2a2a] active:bg-[#363636]',
    ghost: 'bg-transparent text-label-2 hover:bg-[#1e1e1e] hover:text-white',
    danger: 'bg-[#2b1513] text-[#FF5A52] hover:bg-[#3a1c19] active:bg-[#47221e]',
  }
  const sizes = { sm: 'h-9 px-4 text-subhead', md: 'h-11 px-6 text-callout', lg: 'h-12 px-7 text-callout' }
  return (
    <button
      className={clsx(
        'press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold leading-none transition-[background-color,color,transform] duration-200 disabled:pointer-events-none disabled:opacity-40 [&>svg]:shrink-0',
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
  return <div className={clsx('glass rounded-group', className)} {...props}>{children}</div>
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-5">
      <div>
        <h3 className="text-title3 text-label">{title}</h3>
        {subtitle && <p className="mt-0.5 text-footnote text-label-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const SEV_COLORS = { critical: '#FF5A52', high: '#FFA726', medium: '#F2D95C', low: '#5CC8FF' }
const SEV_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }

export function SeverityBadge({ severity }) {
  const c = SEV_COLORS[severity] || SEV_COLORS.low
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-caption font-semibold"
      style={{ color: c, background: `color-mix(in srgb, ${c} 16%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {SEV_LABELS[severity] || severity}
    </span>
  )
}

const MUTED = 'rgba(235,235,245,0.6)'
const STATUS = {
  completed: ['Done', '#3DDC84'],
  running: ['Scanning', '#5CC8FF'],
  queued: ['Starting', MUTED],
  failed: ['Failed', '#FF5A52'],
  open: ['Open', '#FFA726'],
  resolved: ['Rotated', '#3DDC84'],
  false_positive: ['Not a secret', MUTED],
  sent: ['Sent', '#3DDC84'],
  skipped: ['Not sent', MUTED],
}

export function StatusBadge({ status }) {
  const [label, color] = STATUS[status] || [String(status).replace('_', ' '), MUTED]
  if (status === 'open') {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-3 text-footnote font-semibold leading-none text-black">
        <span className="h-[6px] w-[6px] rounded-full bg-[#3DDC84]" />
        {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-footnote font-medium" style={{ color }}>
      <span className={clsx('h-[7px] w-[7px] rounded-full', (status === 'running' || status === 'queued') && 'animate-pulseDot')} style={{ background: color }} />
      {label}
    </span>
  )
}

export function Spinner({ className }) {
  return <Loader2 className={clsx('animate-spin text-white', className || 'h-5 w-5')} />
}

export function PageLoader() {
  return (
    <div className="space-y-4 pt-2" aria-busy="true">
      <div className="skeleton h-10 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="skeleton h-28 rounded-group" />
        <div className="skeleton h-28 rounded-group" />
        <div className="skeleton h-28 rounded-group" />
      </div>
      <div className="skeleton h-64 rounded-group" />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action, color = '#FFFFFF' }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px]" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}>
          <Icon className="h-8 w-8" style={{ color }} />
        </div>
      )}
      <h3 className="text-title3 text-label">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-subhead text-label-2">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, description, actions, back }) {
  return (
    <header className="mb-7">
      {back}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-large-title text-label md:text-[40px] md:leading-[46px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-callout text-label-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1.5 block px-1 text-footnote text-label-3">{hint}</span>}
      {error && <span className="mt-1.5 block px-1 text-footnote text-ios-red">{error}</span>}
    </label>
  )
}

export function RiskMeter({ value, wide }) {
  const v = Math.round(value || 0)
  const color = v >= 75 ? SEV_COLORS.critical : v >= 55 ? SEV_COLORS.high : v >= 30 ? SEV_COLORS.medium : SEV_COLORS.low
  return (
    <div className="flex items-center gap-2">
      <div className={clsx('h-[5px] overflow-hidden rounded-full bg-white/10', wide ? 'w-full' : 'w-14')}>
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={SPRING_SOFT} />
      </div>
      <span className="w-6 text-right font-mono text-footnote tabular-nums text-label-2">{v}</span>
    </div>
  )
}

export function IconTile({ icon: Icon, color = '#FFFFFF', className }) {
  return (
    <span className={clsx('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-b from-[#1c1c1c] to-[#0a0a0a]', className)} style={{ color }}>
      <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
    </span>
  )
}

// iOS-style grouped list: optional title above, rounded glass container, hairline separators between rows.
export function Group({ header, action, footer, className, inset = 16, children }) {
  return (
    <section className={className}>
      {(header || action) && (
        <div className="mb-2 flex items-end justify-between gap-3 px-4">
          {header && <h2 className="text-title3 text-label">{header}</h2>}
          {action}
        </div>
      )}
      <div
        style={{ '--sep-inset': `${inset}px` }}
        className="glass overflow-hidden rounded-group [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:left-[var(--sep-inset)] [&>*+*]:before:right-0 [&>*+*]:before:top-0 [&>*+*]:before:h-px [&>*+*]:before:scale-y-50 [&>*+*]:before:bg-white/[0.14]"
      >
        {children}
      </div>
      {footer && <p className="mt-2 px-4 text-footnote text-label-3">{footer}</p>}
    </section>
  )
}

export function Row({ icon, iconColor, leading, title, subtitle, detail, trailing, chevron, onClick, to, className, titleClassName }) {
  const body = (
    <>
      {leading ?? (icon && <IconTile icon={icon} color={iconColor} />)}
      <div className="min-w-0 flex-1">
        <div className={clsx('truncate text-body text-label', titleClassName)}>{title}</div>
        {subtitle && <div className="truncate text-subhead text-label-2">{subtitle}</div>}
      </div>
      {detail != null && <div className="shrink-0 text-body text-label-2">{detail}</div>}
      {trailing}
      {(chevron || to) && <ChevronRight className="h-4 w-4 shrink-0 text-label-4" strokeWidth={2.5} />}
    </>
  )
  const cls = clsx(
    'flex min-h-[52px] w-full items-center gap-3.5 px-4 py-2.5 text-left',
    (onClick || to) && 'transition-colors hover:bg-white/[0.04] active:bg-white/10',
    className,
  )
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>
  return <div className={cls}>{body}</div>
}

export function Segmented({ options, value, onChange, className, size = 'md' }) {
  const id = useId()
  return (
    <div role="tablist" className={clsx('flex rounded-[16px] bg-white/[0.06] p-[2px]', className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className={clsx(
              'relative flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] px-2 font-medium transition-colors',
              size === 'sm' ? 'h-7 text-footnote' : 'h-8 text-subhead',
              on ? 'text-label' : 'text-label-2 hover:text-label',
            )}
          >
            {on && <motion.span layoutId={`seg-${id}`} transition={SPRING} className="absolute inset-0 rounded-[12px] bg-[#3a3a3a]" />}
            <span className="relative flex items-center gap-1.5">{o.icon && <o.icon className="h-4 w-4" />}{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={clsx('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ease-ios disabled:opacity-40', checked ? 'bg-[#3DDC84]' : 'bg-white/[0.18]')}
    >
      <motion.span layout transition={SPRING} className={clsx('absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.3)]', checked ? 'right-[2px]' : 'left-[2px]')} />
    </button>
  )
}

const NOTICE = {
  info: ['bg-white/10 ring-white/30', 'text-tint-light'],
  warn: ['bg-ios-orange/10 ring-ios-orange/30', 'text-ios-orange'],
  error: ['bg-ios-red/10 ring-ios-red/30', 'text-ios-red'],
  success: ['bg-ios-green/10 ring-ios-green/30', 'text-ios-green'],
}

export function Notice({ tone = 'info', icon: Icon, children, className }) {
  return (
    <div className={clsx('flex items-start gap-3 rounded-3xl px-4 py-3 text-subhead text-label ring-1 ring-inset', NOTICE[tone][0], className)}>
      {Icon && <Icon className={clsx('mt-0.5 h-[18px] w-[18px] shrink-0', NOTICE[tone][1])} />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// Bottom sheet on phones (drag down to dismiss), side panel on larger screens.
export function Sheet({ open, onClose, title, children, footer }) {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  const from = reduce ? { opacity: 0 } : wide ? { x: 40, opacity: 0 } : { y: '100%' }
  const to = reduce ? { opacity: 1 } : wide ? { x: 0, opacity: 1 } : { y: 0 }
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-black/50" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          />
          <motion.aside
            className="glass-thick absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-sheet pb-[env(safe-area-inset-bottom)] md:inset-y-3 md:left-auto md:right-3 md:max-h-none md:w-[520px] md:rounded-sheet md:pb-0"
            initial={from} animate={to} exit={from} transition={SPRING}
            drag={!wide && !reduce ? 'y' : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(e, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }}
          >
            <div className="flex justify-center pt-2 md:hidden"><span className="h-[5px] w-9 rounded-full bg-white/20" /></div>
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 md:pt-5">
              <h2 className="min-w-0 text-headline text-label">{title}</h2>
              <button onClick={onClose} className="press flex h-10 w-10 items-center justify-center rounded-full bg-[#1e1e1e] text-label-2 hover:bg-[#2a2a2a] hover:text-white" aria-label="Close"><X className="h-4 w-4" strokeWidth={2.5} /></button>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto px-5 pb-6 pt-2">{children}</div>
            {footer && <div className="hairline-t px-5 py-4">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
