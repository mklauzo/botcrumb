import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BOTcrumb',
  description: 'AI vs AI Strategy Battle Simulator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen">{children}</body>
    </html>
  )
}
