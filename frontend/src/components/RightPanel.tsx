'use client'

import StatsTable from './StatsTable'
import EventLog from './EventLog'

export default function RightPanel() {
  return (
    <div className="w-72 shrink-0 bg-gray-950 border-l border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="border-b border-gray-800">
        <StatsTable />
      </div>
      <div className="flex-1 min-h-0">
        <EventLog />
      </div>
    </div>
  )
}
