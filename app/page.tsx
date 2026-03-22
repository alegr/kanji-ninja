'use client'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useRef, useCallback } from 'react'
import { KANJI_DATA, KanjiEntry } from '@/lib/kanjiData'

interface ProgEntry { status: string; ease: number; weekSeen: string[] }
interface AppState {
  prog: Record<string, ProgEntry>
  streak: number; lastDay: string | null; lv: string
  q: KanjiEntry[]; qi: number; flipped: boolean
  qt: string; qk: KanjiEntry | null; qa: boolean
  qsc: number; qok: number; qbd: number
}

let S: AppState = {
  prog: {}, streak: 0, lastDay: null, lv: 'all',
  q: [], qi: 0, flipped: false,
  qt: 'meaning', qk: null, qa: false, qsc: 0, qok: 0, qbd: 0,
}

const LEVELS = ['n5', 'n4', 'n3', 'n2'] as const
const LV_COLOR: Record<string,string> = {n5:'var(--n5)',n4:'var(--n4)',n3:'var(--n3)',n2:'var(--n2)'}
function allK(lv: string): KanjiEntry[] {
  if (lv === 'all') return LEVELS.flatMap(l => KANJI_DATA[l] ?? [])
  return KANJI_DATA[lv] ?? []
}
function lvOf(ch: string) { return LEVELS.find(l => KANJI_DATA[l]?.find((k:KanjiEntry) => k.k === ch)) ?? 'n5' }
function st(k: string) { return S.prog[k]?.status ?? 'unseen' }
function wkKey() { const d=new Date(),s=new Date(d); s.setDate(d.getDate()-d.getDay()); return s.toDateString() }
function wkK() { const wk=wkKey(); return allK('all').filter(k => S.prog[k.k]?.weekSeen?.includes(wk)) }
function todayK() { return allK(S.lv).filter(k => ['unseen','seen','learning'].includes(st(k.k))).slice(0,5) }
function shuf<T>(a: T[]): T[] { a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a }
function markK(k: string, s: string) {
  if (!S.prog[k]) S.prog[k] = { status: 'unseen', ease: 0, weekSeen: [] }
  S.prog[k].status = s
  const wk = wkKey(); if (!S.prog[k].weekSeen.includes(wk)) S.prog[k].weekSeen.push(wk)
}
function bumpStreak() {
  const today = new Date().toDateString(); if (S.lastDay === today) return
  const yd = new Date(); yd.setDate(yd.getDate()-1)
  S.streak = S.lastDay === yd.toDateString() ? S.streak+1 : 1
  S.lastDay = today
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoggedIn = status === 'authenticated'

  // Load progress — from server if logged in, from localStorage if guest
  useEffect(() => {
    if (status === 'loading') return
    if (isLoggedIn) {
      fetch('/api/progress')
        .then(r => r.json())
        .then(data => {
          S.prog = data.prog ?? {}
          S.streak = data.streak ?? 0
          S.lastDay = data.lastDay ?? null
          dash()
        })
    } else {
      try {
        const saved = localStorage.getItem('kanji-ninja-guest')
        if (saved) {
          const d = JSON.parse(saved)
          S.prog = d.prog ?? {}; S.streak = d.streak ?? 0; S.lastDay = d.lastDay ?? null
        }
      } catch(e) {}
      dash()
    }
  }, [status, isLoggedIn])

  const saveState = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const syncEl = document.getElementById('sync')
    if (syncEl) { syncEl.className='sync saving'; syncEl.textContent='saving…' }
    saveTimer.current = setTimeout(() => {
      if (isLoggedIn) {
        fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prog: S.prog, streak: S.streak, lastDay: S.lastDay }),
        }).then(() => {
          const el = document.getElementById('sync'); if (el) { el.className='sync saved'; el.textContent='✓ saved' }
          setTimeout(() => { const e=document.getElementById('sync'); if(e){e.textContent=''} }, 2000)
        })
      } else {
        try { localStorage.setItem('kanji-ninja-guest', JSON.stringify({ prog: S.prog, streak: S.streak, lastDay: S.lastDay })) } catch(e) {}
        const el = document.getElementById('sync'); if (el) { el.className='sync saved'; el.textContent='✓ saved' }
        setTimeout(() => { const e=document.getElementById('sync'); if(e){e.textContent=''} }, 2000)
      }
    }, 800)
  }, [isLoggedIn])

  if (status === 'loading') return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',color:'var(--text2)'}}>Loading…</div>

  function toast(m: string) { const t = document.getElementById('toast'); if(!t) return; t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2200) }
  function go(id: string, btn?: HTMLElement | null) { document.querySelectorAll('.panel').forEach(p => p.classList.remove('on')); document.querySelectorAll('.nb').forEach(b => b.classList.remove('on')); document.getElementById('panel-'+id)?.classList.add('on'); if(btn) btn.classList.add('on'); ({dash,fc:initFC,quiz:initQ,prog:renderProg,week:renderWeek} as any)[id]?.() }
  function setLv(lv: string, btn: HTMLElement) { S.lv = lv; document.querySelectorAll('.pill').forEach(p => p.classList.remove('on')); btn.classList.add('on'); dash() }

  function dash() {
    let totalL=0, totalM=0; const pbarsEl = document.getElementById('pbars'); if(!pbarsEl) return; pbarsEl.innerHTML = ''
    LEVELS.forEach(lv => {
      const data = KANJI_DATA[lv] ?? []; const l = data.filter((k:KanjiEntry) => ['learning','mastered'].includes(st(k.k))).length; const m = data.filter((k:KanjiEntry) => st(k.k)==='mastered').length
      totalL += l; totalM += m; const el = document.getElementById('s-'+lv); if(el) el.textContent = l+'/'+data.length
      const pct = Math.round(l/data.length*100)
      pbarsEl.innerHTML += `<div class="prow"><span class="ptag" style="color:${LV_COLOR[lv]}">${lv.toUpperCase()}</span><span class="ppct" style="color:${LV_COLOR[lv]}">${pct}%</span></div><div class="pbar"><div class="pfill" style="background:${LV_COLOR[lv]};width:${pct}%"></div></div>`
    })
    const sAll = document.getElementById('s-all'); if(sAll) sAll.textContent = String(totalL)
    const sMs = document.getElementById('s-ms'); if(sMs) sMs.textContent = String(totalM)
    const strEl = document.getElementById('streak'); if(strEl) strEl.textContent = String(S.streak)
    const tk = todayK(); const lblEl = document.getElementById('today-lbl'); if(lblEl) lblEl.textContent = tk.length ? tk.length+' kanji ready' : 'All caught up! 🎉'
    const row = document.getElementById('today-row'); if(!row) return; row.innerHTML = ''
    tk.forEach(k => { const lv = lvOf(k.k), s = st(k.k); const d = document.createElement('div'); d.className = 'mk '+(s==='mastered'?'mastered lv-'+lv:s==='learning'?'learning':s==='seen'?'seen':''); d.textContent = k.k; d.title = k.m; d.onclick = () => go('fc', document.querySelectorAll<HTMLElement>('.nb')[1]); row.appendChild(d) })
  }

  function initFC() {
    S.q = [...shuf(allK(S.lv).filter(k => st(k.k)==='learning')),...shuf(allK(S.lv).filter(k => st(k.k)==='unseen')),...shuf(allK(S.lv).filter(k => st(k.k)==='seen')),...shuf(allK(S.lv).filter(k => st(k.k)==='mastered'))].slice(0,20)
    S.qi = 0; S.flipped = false; renderFC()
  }
  function renderFC() {
    if(!S.q.length) { const el=document.getElementById('fc-k'); if(el) el.textContent='✿'; return }
    const k = S.q[S.qi]; S.flipped = false; const flipper = document.getElementById('flipper'); if(flipper) flipper.classList.remove('flipped')
    document.getElementById('rrow')?.classList.add('hidden')
    const fcK = document.getElementById('fc-k'); if(fcK) fcK.textContent = k.k
    const ctr = document.getElementById('fc-ctr'); if(ctr) ctr.textContent = 'Card '+(S.qi+1)+' of '+S.q.length
    const bar = document.getElementById('fc-bar'); if(bar) bar.style.width = (S.qi/S.q.length*100)+'%'
    if(st(k.k)==='unseen') markK(k.k, 'seen'); dash()
  }
  function flip() {
    if(S.flipped) return; S.flipped = true
    const k = S.q[S.qi]; const lv = lvOf(k.k)
    const vocabHtml = k.vocab.map(v => `<div class="vi"><span class="vw">${v.w}</span><span class="vr">${v.r}</span><span class="vm">${v.m}</span></div>`).join('')
    const back = document.getElementById('fc-back')
    if(back) back.innerHTML = `<div class="bkanji" style="color:${LV_COLOR[lv]}">${k.k}</div><div class="bmean">${k.m}</div><div class="rtags"><div class="rtag"><span class="rtag-l">音読み</span>${k.on}</div><div class="rtag"><span class="rtag-l">訓読み</span>${k.kun}</div><div class="rtag"><span class="rtag-l">筆数</span>${k.strokes}筆</div><div class="rtag" style="border-color:${LV_COLOR[lv]};color:${LV_COLOR[lv]}">${lv.toUpperCase()}</div></div><div class="vlabel">Example Vocabulary</div>${vocabHtml}<div class="sbox">✏️ ${k.stroke_tip}</div>`
    document.getElementById('flipper')?.classList.add('flipped')
    setTimeout(() => document.getElementById('rrow')?.classList.remove('hidden'), 520)
  }
  function rate(r: string) {
    if(!S.flipped) return; const k = S.q[S.qi]
    if(!S.prog[k.k]) S.prog[k.k] = { status:'seen', ease:0, weekSeen:[] }
    const wk = wkKey(); if(!S.prog[k.k].weekSeen.includes(wk)) S.prog[k.k].weekSeen.push(wk)
    if(r==='hard') { S.prog[k.k].status='learning'; S.q.push(k) }
    else if(r==='good') { S.prog[k.k].status='learning'; S.prog[k.k].ease++ }
    else { S.prog[k.k].status='mastered'; S.prog[k.k].ease+=2 }
    bumpStreak(); saveState(); S.qi++
    if(S.qi >= S.q.length) {
      toast('🎏 Session complete!')
      const bar=document.getElementById('fc-bar'); if(bar) bar.style.width='100%'
      const ctr=document.getElementById('fc-ctr'); if(ctr) ctr.textContent='Session complete – shuffle for more!'
      document.getElementById('flipper')?.classList.remove('flipped'); document.getElementById('rrow')?.classList.add('hidden')
      const fcK=document.getElementById('fc-k'); if(fcK) fcK.textContent='🎏'; dash(); return
    }
    const fl = document.getElementById('flipper')
    if(fl) { fl.style.transition='none'; fl.classList.remove('flipped') }
    document.getElementById('rrow')?.classList.add('hidden'); S.flipped = false
    requestAnimationFrame(() => { if(fl) fl.style.transition=''; renderFC() })
  }

  function setQT(t: string, btn: HTMLElement) { S.qt = t; document.querySelectorAll('.qt').forEach(b => b.classList.remove('on')); btn.classList.add('on'); initQ() }
  function initQ() { S.qsc=0; S.qok=0; S.qbd=0; upQ(); nextQ(); const el=document.getElementById('q-next'); if(el) el.style.display='none' }
  function upQ() { const sc=document.getElementById('q-sc'); if(sc) sc.textContent=String(S.qsc); const ok=document.getElementById('q-ok'); if(ok) ok.textContent=String(S.qok); const bd=document.getElementById('q-bd'); if(bd) bd.textContent=String(S.qbd) }
  function nextQ() {
    const pool = shuf(allK(S.lv)); const el = document.getElementById('q-opts')
    if(pool.length < 4) { if(el) el.innerHTML='<p style="color:var(--text2);text-align:center">Need at least 4 kanji.</p>'; return }
    S.qk = pool[0]; const wr = pool.slice(1,4); S.qa = false
    let lbl:string, dp:string, cor:string, opts:string[]
    if(S.qt==='meaning'){lbl='What does this kanji mean?';dp=S.qk.k;cor=S.qk.m;opts=shuf([cor,...wr.map(k=>k.m)])}
    else if(S.qt==='reading'){lbl='What is the on-reading (音読み)?';dp=S.qk.k;cor=S.qk.on;opts=shuf([cor,...wr.map(k=>k.on)])}
    else{lbl='Which kanji means: '+S.qk.m;dp=S.qk.m;cor=S.qk.k;opts=shuf([cor,...wr.map(k=>k.k)])}
    const lblEl=document.getElementById('q-lbl'); if(lblEl) lblEl.textContent=lbl
    const dpEl=document.getElementById('q-dp'); if(dpEl) dpEl.textContent=dp
    const fb=document.getElementById('q-fb'); if(fb) fb.className='qfb'
    const nxt=document.getElementById('q-next'); if(nxt) nxt.style.display='none'; if(!el) return; el.innerHTML = ''
    opts.forEach(o => { const b = document.createElement('div'); b.className='qo'; b.textContent=o; b.onclick=()=>ansQ(o,cor,b); el.appendChild(b) })
  }
  function ansQ(ch: string, cor: string, btn: HTMLElement) {
    if(S.qa || !S.qk) return; S.qa = true; const ok = ch === cor
    document.querySelectorAll('.qo').forEach(b => { b.classList.add('done'); if(b.textContent===cor) b.classList.add('ok'); else if(b===btn&&!ok) b.classList.add('bad') })
    const fb = document.getElementById('q-fb')
    if(ok) { S.qsc+=10; S.qok++; if(fb){fb.className='qfb on ok';fb.textContent='✓ Correct! '+S.qk!.k+' = '+S.qk!.m}; markK(S.qk!.k,'seen') }
    else { S.qbd++; if(fb){fb.className='qfb on bad';fb.textContent='✗ Answer: '+cor+'. '+S.qk!.k+' = '+S.qk!.m}; markK(S.qk!.k,'learning') }
    const wk = wkKey(); if(!S.prog[S.qk!.k]) S.prog[S.qk!.k]={status:st(S.qk!.k),ease:0,weekSeen:[]}; if(!S.prog[S.qk!.k].weekSeen.includes(wk)) S.prog[S.qk!.k].weekSeen.push(wk)
    upQ(); bumpStreak(); saveState(); const nxt=document.getElementById('q-next'); if(nxt) nxt.style.display='block'
  }

  function renderProg() {
    const el = document.getElementById('prog-sections'); if(!el) return; el.innerHTML = ''
    LEVELS.forEach(lv => {
      const h = document.createElement('div'); h.className='psec'; h.style.color = LV_COLOR[lv]; h.textContent = lv.toUpperCase()+' – '+(KANJI_DATA[lv]?.length??0)+' Kanji'; el.appendChild(h)
      const g = document.createElement('div'); g.className='pg'
      KANJI_DATA[lv]?.forEach((k:KanjiEntry) => { const s = st(k.k); const d = document.createElement('div'); d.className='pk '+s+(s==='mastered'?' lv-'+lv:''); d.textContent=k.k; d.title=k.k+' – '+k.m+' ['+s+']'; d.onclick=()=>toast(k.k+' · '+k.m+' · '+k.on); g.appendChild(d) }); el.appendChild(g)
    })
  }

  function renderWeek() {
    const wk = wkK(), el = document.getElementById('w-list'); if(!el) return
    el.innerHTML = wk.length ? wk.map(k => { const s=st(k.k); const badge = s==='mastered'?'<span class="wbadge wb-m">Mastered</span>':s==='learning'?'<span class="wbadge wb-l">Learning</span>':'<span class="wbadge wb-s">Seen</span>'; return '<div class="wrow"><span class="wkj">'+k.k+'</span><div class="winfo"><div class="wmean">'+k.m+'</div><div class="wread">'+k.on+' / '+k.kun+'</div></div>'+badge+'</div>' }).join('') : '<p style="color:var(--text3);font-size:.8rem;text-align:center;padding:1rem">No kanji studied this week yet.</p>'
    buildEx()
  }
  function buildEx() {
    const wk=wkK(), pool=wk.length>=4?wk:shuf(allK('all')).slice(0,6); const el = document.getElementById('w-ex'); if(!el) return
    if(pool.length < 2) { el.innerHTML='<p style="color:var(--text3);font-size:.78rem">Study more kanji to unlock exercises!</p>'; return }
    const picks = shuf(pool).slice(0,4)
    el.innerHTML = picks.map((k,i) => { const others = pool.filter(x=>x.k!==k.k).slice(0,3); const opts = shuf([k,...others]); return `<div class="wqitem"><div class="wqsen" style="font-size:.75rem;color:var(--text2);margin-bottom:.2rem">Fill in: ${k.m} (${k.on})</div><div class="wqsen">「<span class="blank" id="wb${i}">　</span>」– ${k.vocab[0].w} (${k.vocab[0].m})</div><div class="wqopts">${opts.map(o=>`<span class="wqo" onclick="wqA(this,'${o.k}','${k.k}',${i})">${o.k}</span>`).join('')}</div></div>` }).join('')
  }
  if(typeof window !== 'undefined'){(window as any).wqA = (btn: HTMLElement, ch: string, cor: string, i: number) => { const par = btn.closest('.wqitem') as HTMLElement|null; if(!par||par.dataset.done) return; par.dataset.done='1'; par.querySelectorAll('.wqo').forEach((b:Element) => { (b as HTMLElement).onclick=null; if(b.textContent===cor) b.classList.add('ok'); else if(b===btn&&ch!==cor) b.classList.add('bad') }); const bl=document.getElementById('wb'+i); if(bl){bl.textContent=cor;bl.style.color=ch===cor?'var(--n5)':'var(--accent)'}; toast(ch===cor?'✓ 正解！':'✗ It was: '+cor) }}

  return (
    <>
      {/* Guest banner */}
      {!isLoggedIn && (
        <div className="guest-banner">
          📖 Guest mode — progress saved in this browser only.{' '}
          <button onClick={() => signIn('google', { callbackUrl: '/' })}>Sign in with Google</button> to sync across devices.
        </div>
      )}

      <div className="topbar">
        <div className="logo"><span>漢字</span> Ninja</div>
        <div className="pills">
          <button className="pill p-all on" onClick={e=>setLv('all',e.currentTarget)}>All</button>
          <button className="pill p-n5"     onClick={e=>setLv('n5', e.currentTarget)}>N5</button>
          <button className="pill p-n4"     onClick={e=>setLv('n4', e.currentTarget)}>N4</button>
          <button className="pill p-n3"     onClick={e=>setLv('n3', e.currentTarget)}>N3</button>
          <button className="pill p-n2"     onClick={e=>setLv('n2', e.currentTarget)}>N2</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'.6rem'}}>
          <span id="sync" className="sync"></span>
          <span className="streak">🔥 <span id="streak">0</span> day streak</span>
          {isLoggedIn ? (
            <button className="user-btn" onClick={()=>signOut({callbackUrl:'/login'})}>
              {session?.user?.image && <img src={session.user.image} alt="" className="user-avatar"/>}
              Sign out
            </button>
          ) : (
            <button className="user-btn" onClick={() => signIn('google', { callbackUrl: '/' })}>
              Sign in
            </button>
          )}
        </div>
      </div>

      <nav>
        <button className="nb on"  onClick={e=>go('dash', e.currentTarget)}>📊 Dashboard</button>
        <button className="nb"     onClick={e=>go('fc',   e.currentTarget)}>🃏 Flashcards</button>
        <button className="nb"     onClick={e=>go('quiz', e.currentTarget)}>☯️ Quiz</button>
        <button className="nb"     onClick={e=>go('prog', e.currentTarget)}>📈 Progress</button>
        <button className="nb"     onClick={e=>go('week', e.currentTarget)}>📅 Weekly</button>
      </nav>

      <div className="main">

        {/* DASHBOARD */}
        <div id="panel-dash" className="panel on">
          <div className="stats">
            <div className="stat"><div className="sn ca"  id="s-all">0</div><div className="sl">Learned</div></div>
            <div className="stat"><div className="sn cn5" id="s-n5">0/80</div><div className="sl">N5</div></div>
            <div className="stat"><div className="sn cn4" id="s-n4">0/–</div><div className="sl">N4</div></div>
            <div className="stat"><div className="sn cn3" id="s-n3">0/–</div><div className="sl">N3</div></div>
            <div className="stat"><div className="sn cn2" id="s-n2">0/–</div><div className="sl">N2</div></div>
            <div className="stat"><div className="sn cg"  id="s-ms">0</div><div className="sl">Mastered ⭐</div></div>
          </div>
          <div className="card"><div id="pbars"></div></div>
          <div className="card">
            <div className="clabel">TODAY'S KANJI · <span id="today-lbl"></span></div>
            <div className="krow" id="today-row"></div>
          </div>
          <button className="btn btn-p" onClick={()=>go('fc',document.querySelectorAll<HTMLElement>('.nb')[1])}>Start Flashcards ➔</button>
          <button className="btn btn-s" onClick={()=>go('quiz',document.querySelectorAll<HTMLElement>('.nb')[2])}>Take a Quiz</button>
        </div>

        {/* FLASHCARDS */}
        <div id="panel-fc" className="panel">
          <div className="fc-meta"><span className="fc-ctr" id="fc-ctr">Card 0 of 0</span><button className="btn btn-s btn-sm" onClick={initFC}>↺ Shuffle</button></div>
          <div className="pbar-thin"><div className="pbar-f" id="fc-bar" style={{width:'0%'}}></div></div>
          <div className="scene" onClick={flip}>
            <div className="flipper" id="flipper">
              <div className="face face-front">
                <div className="kbig" id="fc-k">✿</div>
                <div className="khint">tap to flip</div>
              </div>
              <div className="face face-back" id="fc-back"></div>
            </div>
          </div>
          <div className="rrow hidden" id="rrow">
            <button className="rb rb-h" onClick={e=>{rate('hard');e.stopPropagation()}}>😓 Hard</button>
            <button className="rb rb-g" onClick={e=>{rate('good');e.stopPropagation()}}>👍 Good</button>
            <button className="rb rb-e" onClick={e=>{rate('easy');e.stopPropagation()}}>⭐ Easy</button>
          </div>
        </div>

        {/* QUIZ */}
        <div id="panel-quiz" className="panel">
          <div className="qtype">
            <button className="qt on" onClick={e=>setQT('meaning',e.currentTarget)}>Kanji → Meaning</button>
            <button className="qt"    onClick={e=>setQT('reading',e.currentTarget)}>Kanji → Reading</button>
            <button className="qt"    onClick={e=>setQT('reverse',e.currentTarget)}>Meaning → Kanji</button>
          </div>
          <div className="qscores">
            <span className="qs">Score: <strong id="q-sc">0</strong></span>
            <span className="qs">✓ <strong id="q-ok">0</strong></span>
            <span className="qs">✗ <strong id="q-bd">0</strong></span>
          </div>
          <div className="card">
            <div className="clabel" id="q-lbl">What does this kanji mean?</div>
            <div className="qbig" id="q-dp"></div>
            <div className="qopts" id="q-opts"></div>
            <div className="qfb" id="q-fb"></div>
          </div>
          <button className="btn btn-s" id="q-next" style={{display:'none'}} onClick={nextQ}>Next →</button>
        </div>

        {/* PROGRESS */}
        <div id="panel-prog" className="panel">
          <div className="legend">
            <span className="leg"><span className="legdot" style={{borderColor:'var(--border)',opacity:.4}}></span>Unseen</span>
            <span className="leg"><span className="legdot" style={{borderColor:'var(--border2)'}}></span>Seen</span>
            <span className="leg"><span className="legdot" style={{borderColor:'var(--gold)'}}></span>Learning</span>
            <span className="leg"><span className="legdot" style={{borderColor:'var(--n5)'}}></span>N5 Mastered</span>
            <span className="leg"><span className="legdot" style={{borderColor:'var(--n4)'}}></span>N4 Mastered</span>
            <span className="leg"><span className="legdot" style={{borderColor:'var(--n3)'}}></span>N3 Mastered</span>
            <span className="leg"><span className="legdot" style={{borderColor:'var(--n2)'}}></span>N2 Mastered</span>
          </div>
          <div id="prog-sections"></div>
        </div>

        {/* WEEKLY */}
        <div id="panel-week" className="panel">
          <div className="card"><div className="clabel">THIS WEEK'S KANJI</div><div id="w-list"></div></div>
          <div className="clabel" style={{marginBottom:'.5rem'}}>FILL-IN EXERCISES</div>
          <div id="w-ex"></div>
          <button className="btn btn-s" onClick={buildEx}>↺ New Exercises</button>
        </div>

      </div>
      <div className="toast" id="toast"></div>
    </>
  )
}
