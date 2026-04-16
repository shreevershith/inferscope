export default function SkeletonCard({ className = 'h-28' }) {
  return <div className={`skeleton ${className}`} />
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="skeleton p-4 space-y-4">
      <div className="h-8 bg-slate-700/30 rounded w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-slate-700/20 rounded w-full" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )
}
