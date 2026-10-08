import { GitCommit } from 'lucide-react'
import { RiskMeter, SeverityBadge, StatusBadge } from './ui'
import { timeAgo } from '../lib/format'

export default function FindingsTable({ items, onSelect, compact = false }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink-800 text-[11px] uppercase tracking-wider text-ink-400">
            <th className="px-5 py-3 font-medium">Severity</th>
            <th className="px-3 py-3 font-medium">Credential</th>
            <th className="px-3 py-3 font-medium">Location</th>
            <th className="px-3 py-3 font-medium">Risk</th>
            {!compact && <th className="px-3 py-3 font-medium">Status</th>}
            {!compact && <th className="px-5 py-3 text-right font-medium">Found</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id} onClick={() => onSelect?.(f)} className="cursor-pointer border-b border-ink-800/60 transition hover:bg-ink-800/40">
              <td className="px-5 py-3"><SeverityBadge severity={f.severity} /></td>
              <td className="px-3 py-3">
                <div className="font-medium text-white">{f.credential_type}</div>
                <div className="font-mono text-xs text-ink-400">{f.secret_masked}</div>
              </td>
              <td className="max-w-xs px-3 py-3">
                <div className="truncate font-mono text-xs text-ink-200" title={`${f.repository || ''}/${f.file_path || ''}`}>
                  {f.repository && <span className="text-ink-400">{f.repository}/</span>}{f.file_path}{f.line_number ? `:${f.line_number}` : ''}
                </div>
                {f.in_history_only && (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-signal"><GitCommit className="h-3 w-3" /> only in history</div>
                )}
              </td>
              <td className="px-3 py-3"><RiskMeter value={f.risk_score} /></td>
              {!compact && <td className="px-3 py-3"><StatusBadge status={f.status} /></td>}
              {!compact && <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-ink-400">{timeAgo(f.first_seen)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
