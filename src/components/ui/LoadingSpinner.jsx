export default function LoadingSpinner({ size = 'md', label = 'Loading...' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
      <div className={`${sizes[size]} border-2 border-slate-700 border-t-primary rounded-full animate-spin`} />
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}
