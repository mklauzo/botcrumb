'use client'

import StatsTable from './StatsTable'
import EventLog from './EventLog'

interface RightPanelProps {
  onClose?: () => void
}

export default function RightPanel({ onClose }: RightPanelProps) {
  return (
    <div className="w-72 shrink-0 bg-gray-950 border-l border-gray-800 flex flex-col h-full overflow-hidden">
      {/* Header with close button (visible on mobile) */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-800 md:hidden">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Panel</span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-lg leading-none px-1"
          title="Zamknij panel"
        >
          ✕
        </button>
      </div>
      <div className="border-b border-gray-800">
        <StatsTable />
      </div>
      <div className="flex-1 min-h-0">
        <EventLog />
      </div>
    </div>
  )
}
