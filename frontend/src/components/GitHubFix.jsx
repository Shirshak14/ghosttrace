import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { CheckCircle2, ExternalLink, GitCommit, Loader2, Pencil, RefreshCw, TriangleAlert } from 'lucide-react'
import { api } from '../lib/api'
import { SPRING } from '../lib/motion'
import { Button } from './ui'
import { useToast } from './Toast'

const canFixOnGitHub = (f) => f?.source_type === 'github' && !!f.repository && !!f.file_path

// Fetches the file again from GitHub and reports whether the secret is still in it.
function useRecheck(onChange) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  async function run(f) {
    setBusy(true)
    try {
      const r = await api(`/api/findings/${f.id}/recheck`, { method: 'POST' })
      setResult(r)
      onChange?.(r.finding, false)
      return r
    } catch (e) {
      toast(e.message, 'error')
      return null
    } finally {
      setBusy(false)
    }
  }
  return { run, busy, result, reset: () => setResult(null) }
}

function RecheckResult({ result }) {
  if (!result) return null
  const fixed = !result.present
  const Icon = fixed ? CheckCircle2 : TriangleAlert
  return (
    <div className={clsx('flex items-start gap-2.5 rounded-row px-3.5 py-3 text-footnote', fixed ? 'bg-ios-green/10 text-label' : 'bg-ios-orange/10 text-label')}>
      <Icon className={clsx('mt-px h-4 w-4 shrink-0', fixed ? 'text-ios-green' : 'text-ios-orange')} />
      <span>{result.message}</span>
    </div>
  )
}

// Links follow the latest recheck (it knows the live default branch), then the stored finding.
function links(f, result) {
  return {
    edit: result ? result.edit_url : f.edit_url,
    view: result ? result.view_url : f.view_url,
    line: result ? result.line : f.line_number,
  }
}

function MenuLink({ href, icon: Icon, title, subtitle }) {
  return (
    <a
      href={href} target="_blank" rel="noreferrer"
      className="flex items-center gap-3 rounded-row px-3 py-2.5 transition-colors hover:bg-white/[0.07] active:bg-white/10"
    >
      <Icon className="h-4 w-4 shrink-0 text-label-2" />
      <span className="min-w-0 flex-1">
        <span className="block text-subhead text-label">{title}</span>
        {subtitle && <span className="block truncate text-caption text-label-3">{subtitle}</span>}
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-label-4" />
    </a>
  )
}

// Pencil button on a finding row that opens a small popover: edit on GitHub, view the file, recheck.
export function FixMenu({ finding: f, onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const anchor = useRef(null)
  const panel = useRef(null)
  const { run, busy, result, reset } = useRecheck(onChange)
  const l = links(f, result)

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = anchor.current.getBoundingClientRect()
      const width = Math.min(304, window.innerWidth - 24)
      const height = panel.current?.offsetHeight || 220
      const below = r.bottom + 8 + height < window.innerHeight
      setPos({
        left: Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12)),
        top: below ? r.bottom + 8 : Math.max(12, r.top - height - 8),
        width,
        origin: below ? 'top right' : 'bottom right',
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, result])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!panel.current?.contains(e.target) && !anchor.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (!canFixOnGitHub(f)) return <span className="hidden w-8 sm:block" />

  const toggle = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!open) reset()
    setOpen((o) => !o)
  }

  return (
    <>
      {/* A span, not a button: it sits inside the row's button and must not open the drawer. */}
      <span
        ref={anchor} role="button" tabIndex={0} aria-label="Fix on GitHub" aria-haspopup="dialog" aria-expanded={open} title="Fix on GitHub"
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e) }}
        className={clsx(
          'press flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
          open ? 'bg-white text-black' : 'bg-white/[0.06] text-label-2 hover:bg-white/[0.14] hover:text-white',
        )}
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={panel} role="dialog" aria-label="Fix on GitHub"
              onClick={(e) => e.stopPropagation()}
              style={{ left: pos.left, top: pos.top, width: pos.width, transformOrigin: pos.origin }}
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={SPRING}
              className="glass-thick fixed z-[55] rounded-[22px] p-2 text-left shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
            >
              <div className="px-3 pb-2 pt-1.5">
                <div className="text-caption font-semibold uppercase tracking-wide text-label-3">Fix on GitHub</div>
                <div className="mt-0.5 truncate font-mono text-footnote text-label-2" title={`${f.repository}/${f.file_path}`}>
                  {f.file_path}{l.line ? `:${l.line}` : ''}
                </div>
              </div>
              {l.edit && <MenuLink href={l.edit} icon={Pencil} title="Edit on GitHub" subtitle={l.line ? `Change line ${l.line}, then commit` : 'Open the file in the web editor'} />}
              {f.in_history_only && f.url && <MenuLink href={f.url} icon={GitCommit} title={`View commit ${f.commit_sha?.slice(0, 7) || ''}`} subtitle="Where the secret was added" />}
              {l.view && <MenuLink href={l.view} icon={ExternalLink} title="View file" subtitle={f.repository} />}
              <button
                type="button" onClick={() => run(f)} disabled={busy}
                className="flex w-full items-center gap-3 rounded-row px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07] active:bg-white/10 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-label-2" /> : <RefreshCw className="h-4 w-4 shrink-0 text-label-2" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-subhead text-label">{busy ? 'Checking GitHub…' : 'Recheck'}</span>
                  <span className="block text-caption text-label-3">See if the alert is gone after your commit</span>
                </span>
              </button>
              {result && <div className="px-1 pb-1 pt-1.5"><RecheckResult result={result} /></div>}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

// Drawer section: edit the file on GitHub, commit, then recheck.
export function FixPanel({ finding: f, onChange }) {
  const { run, busy, result, reset } = useRecheck(onChange)
  const l = links(f, result)
  useEffect(() => { reset() }, [f.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!canFixOnGitHub(f)) return null

  const steps = f.in_history_only && !l.edit
    ? ['Rotate the key with its provider. It lives in an old commit, so editing the file now cannot remove it.', 'Recheck to confirm it is not in the current code.']
    : [`Open the file in GitHub's editor${l.line ? ` and go to line ${l.line}` : ''}.`, 'Replace the secret with an environment variable and commit.', 'Recheck to confirm the alert is gone.']

  return (
    <section>
      <h3 className="label">Fix on GitHub</h3>
      <div className="space-y-3 rounded-row bg-white/[0.06] p-4">
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-subhead text-label-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-caption font-semibold tabular-nums text-label">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 pt-1">
          {l.edit ? (
            <Button size="sm" onClick={() => window.open(l.edit, '_blank', 'noopener')}><Pencil className="h-4 w-4" /> Edit on GitHub</Button>
          ) : l.view && (
            <Button size="sm" variant="secondary" onClick={() => window.open(l.view, '_blank', 'noopener')}><ExternalLink className="h-4 w-4" /> View file</Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => run(f)} loading={busy}>{!busy && <RefreshCw className="h-4 w-4" />} Recheck</Button>
        </div>
        <AnimatePresence initial={false}>
          {result && (
            <motion.div key={result.checked_at} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}>
              <RecheckResult result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
