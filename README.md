# 漢字 Kanji Ninja

Interactive JLPT kanji study app — N5, N4, N3, N2.

## Features
- 390+ kanji with flashcards, quizzes, and progress tracking
- Google login — progress saved per user
- Spaced repetition (Hard / Good / Easy rating)
- Weekly review & fill-in exercises

## Stack
- Next.js 14 (App Router)
- NextAuth.js (Google OAuth)
- Prisma + SQLite
- Deployed on Vercel

## Local development
\`\`\`bash
cp .env.example .env.local
# fill in your values
npm install
npx prisma db push
npm run dev
\`\`\`
