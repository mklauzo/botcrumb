'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'

function useGameTimer() {
  const gameStartTime = useGameStore(s => s.gameStartTime)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!gameStartTime) { setElapsed(0); return }
    const update = () => setElapsed(Math.floor((Date.now() - gameStartTime) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [gameStartTime])

  if (!gameStartTime) return null
  const d = Math.floor(elapsed / 86400)
  const h = Math.floor((elapsed % 86400) / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  parts.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
  return parts.join(' ')
}

export default function StatsTable() {
  const tribes = useGameStore(s => s.tribes)
  const timer = useGameTimer()

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-800">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tribes</span>
        {timer && <span className="text-xs text-gray-500 tabular-nums">{timer}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left px-2 py-1">Name</th>
              <th className="text-right px-1 cursor-help" title="Energy">E</th>
              <th className="text-right px-1 cursor-help" title="Workers">W</th>
              <th className="text-right px-1 cursor-help" title="Attackers">A</th>
              <th className="text-right px-1 cursor-help" title="Defenders">D</th>
              <th className="text-right px-1 cursor-help" title="Queen">Q</th>
            </tr>
          </thead>
          <tbody>
            {tribes.map(t => (
              <tr
                key={t.id}
                className={`border-b border-gray-900 ${!t.alive ? 'opacity-30' : ''}`}
              >
                <td
                  className="px-2 py-0.5 font-mono"
                  style={{ color: t.color }}
                  title={!t.alive
                    ? `Szczyt jednostek:\nWorkers: ${t.maxUnits.worker}\nAttackers: ${t.maxUnits.attacker}\nDefenders: ${t.maxUnits.defender}\nQueens: ${t.maxUnits.queen}`
                    : undefined}
                >
                  {t.alive ? '' : '✗ '}{t.name}{t.palace_bricks > 0 && <span title={`Pałac: ${t.palace_bricks} cegieł`} className="ml-1 text-amber-400">⬡</span>}
                </td>
                <td className="text-right px-1 text-yellow-400">{t.energy}</td>
                <td className="text-right px-1 text-blue-400">{t.units.worker}</td>
                <td className="text-right px-1 text-red-400">{t.units.attacker}</td>
                <td className="text-right px-1 text-green-400">{t.units.defender}</td>
                <td className="text-right px-1 text-purple-400">{t.units.queen}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-2 py-1 text-gray-600 text-xs">
          E=energy W=workers A=attackers D=defenders Q=queen
        </div>
      </div>
    </div>
  )
}
