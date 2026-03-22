import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: '漢字 Study — JLPT N5·N4·N3·N2',
  description: 'Interactive JLPT kanji study app with flashcards, quizzes, and progress tracking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
