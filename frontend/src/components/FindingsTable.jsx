import { GitCommit } from 'lucide-react'
import { RiskMeter, Row, SeverityBadge, StatusBadge } from './ui'
import { timeAgo } from '../lib/format'
import { FixMenu } from './GitHubFix'

// Renders finding rows; wrap in <Group> to get the grouped-list container.
export default function FindingsTable({ items, onSelect, onChange, compact = false }) {
  return items.map((f) => (
    <Row
      key={f.id}
      onClick={() => onSelect?.(f)}
      chevron
      leading={<SeverityBadge severity={f.severity} />}
      title={f.credential_type}
      subtitle={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-footnote" title={`${f.repository || ''}/${f.file_path || ''}`}>
            {f.repository && <span className="text-label-3">{f.repository}/</span>}{f.file_path}{f.line_number ? `:${f.line_number}` : ''}
          </span>
          {f.in_history_only && <span className="flex shrink-0 items-center gap-1 text-caption text-label-3"><GitCommit className="h-3 w-3" /> history</span>}
        </span>
      }
      trailing={
        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden sm:block"><RiskMeter value={f.risk_score} /></div>
          {!compact && <div className="hidden w-24 md:block"><StatusBadge status={f.status} /></div>}
          {!compact && <span className="hidden w-16 text-right text-footnote text-label-3 lg:block">{timeAgo(f.first_seen)}</span>}
          <FixMenu finding={f} onChange={onChange} />
        </div>
      }
      className="[&>div:first-child]:min-w-[76px]"
    />
  ))
}
