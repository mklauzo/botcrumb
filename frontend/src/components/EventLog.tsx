'use client'

import { useGameStore } from '@/store/gameStore'

export default function EventLog() {
  const eventLog = useGameStore(s => s.eventLog)
  const tribes = useGameStore(s => s.tribes)
  const energySources = useGameStore(s => s.energySources)

  const getTribeColor = (tribeId: number) => {
    return tribes.find(t => t.id === tribeId)?.color ?? '#aaa'
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'energy_found': return '⚡'
      case 'unit_killed': return '💀'
      case 'queen_killed': return '👑'
      default: return '•'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 py-1 border-b border-gray-800">
        Event Log
      </div>
      <div className="flex gap-3 px-2 py-1 border-b border-gray-800 text-xs tabular-nums">
        <span className="text-gray-500">Źródła: <span className="text-white">{energySources.total}</span></span>
        <span className="text-gray-500">Eksploatowane: <span className="text-yellow-400">{energySources.exploited}</span></span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {eventLog.length === 0 && (
          <p className="text-gray-600 text-xs italic">Waiting for events...</p>
        )}
        {[...eventLog].sort((a, b) => b.id - a.id).map(ev => (
          <div key={ev.id} className="flex gap-1.5 text-xs leading-relaxed">
            <span>{getIcon(ev.type)}</span>
            <span className="text-gray-600 shrink-0 tabular-nums">
              {new Date(ev.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span style={{ color: getTribeColor(ev.tribe_id) }} className="shrink-0">
              [{ev.type.replace(/_/g, ' ')}]
            </span>
            <span className="text-gray-300 break-words min-w-0">{ev.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
