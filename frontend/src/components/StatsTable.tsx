'use client'

import { useGameStore } from '@/store/gameStore'

export default function StatsTable() {
  const tribes = useGameStore(s => s.tribes)

  return (
    <div className="flex flex-col">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 py-1 border-b border-gray-800">
        Tribes
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
                  {t.alive ? '' : '✗ '}{t.name}
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
