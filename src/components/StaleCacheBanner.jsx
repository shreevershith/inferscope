import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { useModelData } from '../hooks/useModelData'
import { formatRelativeTime } from '../lib/timeUtils'

/**
 * Banner that surfaces when the user is seeing localStorage-cached data
 * because at least one upstream fetch failed AND we have no fresh data yet.
 *
 * Mounts at the top of the page so the user knows the numbers below may be
 * stale, with a Retry button to force SWR to revalidate.
 */
export default function StaleCacheBanner() {
  const { fromCache, sourceErrors, error, fetchedAt } = useModelData()
  const { mutate } = useSWRConfig()
  const [dismissed, setDismissed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // Only show when we're displaying cached data AND a fetch error happened.
  // If fromCache is true but no errors, the fresh data is on its way — quiet.
  const failed = sourceErrors.length > 0 || !!error
  if (!fromCache || !failed || dismissed) return null

  const failedSources = sourceErrors.length > 0
    ? sourceErrors.join(' + ')
    : 'live feed'

  const handleRetry = async () => {
    setRetrying(true)
    try {
      // Bust SWR cache key and revalidate
      await mutate('model-data', undefined, { revalidate: true })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      role="status"
      className="w-full bg-amber-500/10 border-y border-amber-500/30"
    >
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 py-2.5 flex items-center gap-3 text-xs">
        <span className="material-symbols-outlined text-amber-400 text-base shrink-0">cloud_off</span>
        <p className="flex-1 dark:text-amber-100 text-amber-900 font-medium">
          Showing cached data from <span className="font-bold">{formatRelativeTime(fetchedAt)}</span> — {failedSources} unavailable. Numbers below may be stale.
        </p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="text-[0.65rem] font-black tracking-wider uppercase dark:text-amber-300 text-amber-700 hover:text-amber-200 disabled:opacity-50 flex items-center gap-1"
        >
          <span className={`material-symbols-outlined text-sm ${retrying ? 'animate-spin' : ''}`}>refresh</span>
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="dark:text-amber-300/70 text-amber-700/70 dark:hover:text-amber-200 hover:text-amber-900 p-1 -mr-1"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  )
}
