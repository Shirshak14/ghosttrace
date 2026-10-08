import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, LayoutDashboard, LogOut, Menu, Radar, Settings, ShieldAlert, Eye, X, MailWarning } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/scans', label: 'Scans', icon: Radar },
  { to: '/app/findings', label: 'Findings', icon: ShieldAlert },
  { to: '/app/breach', label: 'Breach Intel', icon: MailWarning },
  { to: '/app/monitors', label: 'Monitors', icon: Eye },
  { to: '/app/alerts', label: 'Alerts', icon: Bell },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo to="/app" />
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => clsx(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
              isActive ? 'bg-cyan/10 text-cyan' : 'text-ink-300 hover:bg-ink-800 hover:text-white',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ink-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-signal to-cyan font-semibold text-ink-950">
            {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{user?.full_name || 'Analyst'}</div>
            <div className="truncate text-xs text-ink-400">{user?.email}</div>
          </div>
          <button onClick={logout} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white" title="Sign out" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const current = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))
  return (
    <div className="min-h-screen bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-800 bg-ink-900/60 lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-ink-800 bg-ink-900">
            <button className="absolute right-3 top-5 rounded-md p-1.5 text-ink-300 hover:bg-ink-800" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-800 bg-ink-950/80 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-ink-200 hover:bg-ink-800" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-white">{current?.label || 'GhostTrace'}</span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
