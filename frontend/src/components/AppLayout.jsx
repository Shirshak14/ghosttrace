import { Suspense, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { EASE_IOS, SPRING } from '../lib/motion'
import { Bell, Eye, House, LogOut, MailCheck, MailWarning, MoreHorizontal, Plus, Radar, Settings, ShieldAlert, X } from 'lucide-react'
import Logo from './Logo'
import { Button, PageLoader } from './ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useConfirm, useToast } from './Toast'

const MAIN = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/scans', label: 'Scan', icon: Radar },
  { to: '/app/findings', label: 'Findings', icon: ShieldAlert },
  { to: '/app/breach', label: 'Breaches', icon: MailWarning },
  { to: '/app/monitors', label: 'Monitoring', icon: Eye },
]
const ACCOUNT = [
  { to: '/app/alerts', label: 'Alerts', icon: Bell },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]
const ALL = [...MAIN, ...ACCOUNT]

const isActive = (item, path) => (item.end ? path === item.to : path.startsWith(item.to))

function Avatar({ user, className = 'h-9 w-9 text-subhead' }) {
  return (
    <span className={clsx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#8E8E93] to-[#3A3A3A] font-semibold text-white', className)}>
      {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
    </span>
  )
}

function Sidebar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const link = (item) => {
    const active = isActive(item, pathname)
    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={clsx(
          'relative flex h-10 items-center gap-3 rounded-[16px] px-3 text-callout transition-colors',
          active ? 'text-white' : 'text-label-2 hover:bg-white/5 hover:text-label',
        )}
      >
        {active && <motion.span layoutId="side-active" transition={SPRING} className="absolute inset-0 rounded-[16px] bg-white/[0.12]" />}
        <Icon className="relative h-[19px] w-[19px]" strokeWidth={2} />
        <span className="relative">{item.label}</span>
      </NavLink>
    )
  }
  return (
    <div className="glass flex h-full flex-col rounded-sheet p-3">
      <div className="px-2 pb-5 pt-2"><Logo to="/app" /></div>
      <button
        onClick={() => navigate('/app/scans')}
        className="press mb-4 flex h-10 items-center justify-center gap-2 rounded-[16px] bg-white/10 text-callout font-semibold text-label hover:bg-white/15"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> New scan
      </button>
      <nav className="space-y-0.5">{MAIN.map(link)}</nav>
      <div className="mt-5 px-3 pb-1 text-footnote text-label-3">Account</div>
      <nav className="space-y-0.5">{ACCOUNT.map(link)}</nav>
      <div className="mt-auto flex items-center gap-3 rounded-3xl bg-white/[0.04] p-2.5">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-subhead font-medium text-label">{user?.full_name || 'Your account'}</div>
          <div className="truncate text-caption text-label-3">{user?.email}</div>
        </div>
        <button
          onClick={async () => { if (await confirm({ title: 'Sign out?', confirmLabel: 'Sign out', destructive: true })) logout() }}
          className="press rounded-full p-2 text-label-3 hover:bg-white/10 hover:text-label"
          aria-label="Sign out" title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function TabBar({ onMore }) {
  const { pathname } = useLocation()
  const tabs = MAIN.slice(0, 4)
  const moreActive = !tabs.some((t) => isActive(t, pathname))
  const cls = (on) => clsx('press flex flex-col items-center gap-0.5 py-1 text-caption2 font-medium', on ? 'text-tint-light' : 'text-label-3')
  return (
    <nav className="glass-bar hairline-t fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 lg:hidden">
      {tabs.map((t) => {
        const on = isActive(t, pathname)
        const Icon = t.icon
        return (
          <NavLink key={t.to} to={t.to} end={t.end} className={cls(on)}>
            <Icon className="h-6 w-6" strokeWidth={on ? 2.3 : 1.8} />
            {t.label}
          </NavLink>
        )
      })}
      <button onClick={onMore} className={cls(moreActive)}>
        <MoreHorizontal className="h-6 w-6" strokeWidth={moreActive ? 2.3 : 1.8} />
        More
      </button>
    </nav>
  )
}

function TopBar() {
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const current = ALL.find((n) => isActive(n, pathname))
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 56)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [pathname])
  return (
    <header className={clsx(
      'fixed inset-x-0 top-0 z-30 flex h-[calc(44px+env(safe-area-inset-top))] items-end justify-center pb-2.5 transition-all duration-300 ease-ios lg:hidden',
      scrolled ? 'glass-bar hairline-b' : 'bg-transparent',
    )}>
      <span className={clsx('text-headline text-label transition-opacity duration-200', scrolled ? 'opacity-100' : 'opacity-0')}>
        {current?.label || 'GhostTrace'}
      </span>
    </header>
  )
}

function MoreSheet({ open, onClose }) {
  const { user, logout } = useAuth()
  const confirm = useConfirm()
  const row = 'flex min-h-[52px] w-full items-center gap-3.5 px-4 py-2.5 text-left text-body transition-colors hover:bg-white/[0.04] active:bg-white/10'
  return (
    <AnimatePresence>
    {open && (
    <div className="fixed inset-0 z-40 lg:hidden">
      <motion.div className="absolute inset-0 bg-black/60" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        className="glass-thick absolute inset-x-0 bottom-0 rounded-t-sheet p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={SPRING}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title3 text-label">More</h2>
          <button onClick={onClose} className="press rounded-full bg-white/10 p-2 text-label-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-5 flex items-center gap-3 px-1">
          <Avatar user={user} className="h-12 w-12 text-title3" />
          <div className="min-w-0">
            <div className="truncate text-headline text-label">{user?.full_name || 'Your account'}</div>
            <div className="truncate text-subhead text-label-2">{user?.email}</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="glass divide-y divide-white/10 overflow-hidden rounded-group">
            {[MAIN[4], ...ACCOUNT].map((item) => (
              <NavLink key={item.to} to={item.to} onClick={onClose} className={row}>
                <item.icon className="h-5 w-5 text-label-2" strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            ))}
          </div>
          <div className="glass overflow-hidden rounded-group">
            <button className={clsx(row, 'text-ios-red')} onClick={async () => { if (await confirm({ title: 'Sign out?', confirmLabel: 'Sign out', destructive: true })) { onClose(); logout() } }}>Sign out</button>
          </div>
        </div>
      </motion.div>
    </div>
    )}
    </AnimatePresence>
  )
}

function VerifyBanner() {
  const { user } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!user || user.email_verified) return null
  async function resend() {
    setBusy(true)
    try {
      toast((await api('/api/auth/resend-verification', { method: 'POST' })).message)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="glass mb-6 flex flex-col gap-3 rounded-group p-4 sm:flex-row sm:items-center">
      <MailCheck className="h-5 w-5 shrink-0 text-[#FFA726]" />
      <div className="min-w-0 flex-1 text-subhead text-label-2">
        <span className="font-medium text-label">Confirm your email to get leak alerts.</span>{' '}
        We sent a link to {user.email}.
      </div>
      <Button variant="gray" size="sm" loading={busy} onClick={resend}>Send a new link</Button>
    </div>
  )
}

// Keeps the outgoing page's content mounted while it animates out, instead of swapping to the new route.
function FrozenOutlet() {
  const outlet = useOutlet()
  const [frozen] = useState(outlet)
  return frozen
}

export default function AppLayout() {
  const [more, setMore] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-[264px] lg:block"><Sidebar /></aside>
      <TopBar />
      <div className="lg:pl-[280px]">
        <main className="mx-auto max-w-6xl px-4 pb-32 pt-[calc(52px+env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          <VerifyBanner />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE_IOS }}
            >
              <Suspense fallback={<PageLoader />}><FrozenOutlet /></Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <TabBar onMore={() => setMore(true)} />
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </div>
  )
}
