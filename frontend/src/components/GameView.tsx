'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import GameCanvas from './GameCanvas'
import RightPanel from './RightPanel'

export default function GameView() {
  const winner = useGameStore(s => s.winner)
  const resetGame = useGameStore(s => s.resetGame)
  const [panelOpen, setPanelOpen] = useState(true)

  // On mobile default to closed
  useEffect(() => {
    setPanelOpen(window.innerWidth >= 768)
  }, [])

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden">
      {/* Panel toggle button — fixed above everything, shifts with panel */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        className="fixed top-2 z-30 bg-gray-900/80 border border-gray-700 rounded p-1.5 text-gray-400 hover:text-white text-sm leading-none select-none transition-[right] duration-200"
        style={{ right: panelOpen ? '296px' : '8px' }}
        title={panelOpen ? 'Ukryj panel' : 'Pokaż panel'}
      >
        {panelOpen ? '›' : '‹'}
      </button>

      {/* Main 3D view */}
      <div className="flex-1 relative min-w-0">
        <GameCanvas />

        {winner && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black bg-opacity-80 border border-gray-700 rounded-xl px-10 py-8 text-center pointer-events-auto">
              <div className="text-4xl mb-2">👑</div>
              <div className="text-2xl font-bold text-white mb-1">
                {winner.name}
              </div>
              <div className="text-gray-400 mb-6">wins the battle!</div>
              <button
                onClick={resetGame}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                New Game
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — overlay on mobile, sidebar on desktop */}
      {panelOpen && (
        <div className="fixed md:relative right-0 top-0 h-full z-20 md:z-auto">
          <RightPanel onClose={() => setPanelOpen(false)} />
        </div>
      )}
    </div>
  )
}
