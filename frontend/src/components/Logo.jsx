import { Link } from 'react-router-dom'

export function GhostMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0b1628" />
      <path
        d="M16 6c-5 0-8.5 3.6-8.5 8.6V26l2.8-2 2.9 2 2.8-2 2.8 2 2.9-2 2.8 2V14.6C24.5 9.6 21 6 16 6Z"
        fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round"
      />
      <circle cx="13" cy="15" r="1.6" fill="#22d3ee" />
      <circle cx="19" cy="15" r="1.6" fill="#22d3ee" />
    </svg>
  )
}

export default function Logo({ to = '/', compact = false }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <GhostMark />
      {!compact && (
        <span className="text-lg font-bold tracking-tight text-white">
          Ghost<span className="text-cyan">Trace</span>
        </span>
      )}
    </Link>
  )
}
