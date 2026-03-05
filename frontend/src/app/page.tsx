'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useGameStore } from '@/store/gameStore'
import SetupMenu from '@/components/SetupMenu'

const GameView = dynamic(() => import('@/components/GameView'), { ssr: false })

export default function Home() {
  const gamePhase = useGameStore(s => s.gamePhase)
  const setGamePhase = useGameStore(s => s.setGamePhase)
  const [checking, setChecking] = useState(true)

  // On first load, check if a game is already running on the server
  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        if (data.state === 'running' || data.state === 'over') {
          setGamePhase('playing')  // jump straight to game view
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [setGamePhase])

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-600 text-sm animate-pulse">Connecting...</div>
      </div>
    )
  }

  if (gamePhase === 'setup') return <SetupMenu />
  return <GameView />
}
