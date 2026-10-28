import { useEffect, useMemo, useState } from 'react';
import Lenis from 'lenis';
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Clock3, Feather,
  Flower2, LayoutDashboard, Plus, Search, Settings2, Sparkles, Target,
  Trash2, X, CalendarDays, Palette, UserRound, ChevronLeft, ChevronRight
} from 'lucide-react';

const moods = ['Calm', 'Focused', 'Hopeful', 'Tired', 'Grateful'];
const themes = [
  { id: 'sage', label: 'Sage', color: '#879276' },
  { id: 'blue', label: 'Blue', color: '#718ba6' },
  { id: 'rose', label: 'Rose', color: '#b7837d' },
  { id: 'amber', label: 'Amber', color: '#b18a52' }
];
const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    let message = 'Something went wrong.';
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}
const dateKey = (value) => {
  if (!value) return '';
  const d = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const entryDate = (value) => {
  const d = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

function App() {
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDetail, setGoalDetail] = useState('');
  const [goalDueDate, setGoalDueDate] = useState(() => dateKey(new Date().toISOString()));
  const [journalText, setJournalText] = useState('');
  const [mood, setMood] = useState('Calm');
  const [activeTab, setActiveTab] = useState('overview');
  const [modal, setModal] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [profileName, setProfileName] = useState(() => localStorage.getItem('mirror-name') || 'Akash');
  const [nameDraft, setNameDraft] = useState(() => localStorage.getItem('mirror-name') || 'Akash');
  const [theme, setTheme] = useState(() => localStorage.getItem('mirror-theme') || 'sage');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date().toISOString()));

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 0.9 });
    let rafId;
    const raf = (time) => { lenis.raf(time); rafId = requestAnimationFrame(raf); };
    rafId = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(rafId); lenis.destroy(); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mirror-theme', theme);
  }, [theme]);

  useEffect(() => {
    Promise.all([api('/api/goals'), api('/api/journal')])
      .then(([g, j]) => { setGoals(g); setEntries(j); })
      .catch(() => setError('Could not connect to the backend. Start the server with npm start.'))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const completed = goals.filter(g => Number(g.completed) === 1 || g.completed === true).length;
  const progress = goals.length ? Math.round((completed / goals.length) * 100) : 0;
  const latestEntry = entries[0];
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }, []);
  const weekStart = new Date(); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate() - 6);
  const recentEntries = entries.filter(e => entryDate(e.created_at) >= weekStart).length;
  const recentCompleted = goals.filter(g => Number(g.completed) === 1 || g.completed === true).length;

  async function addGoal(event) {
    event.preventDefault();
    if (!goalTitle.trim()) return;
    try {
      const goal = await api('/api/goals', { method: 'POST', body: JSON.stringify({ title: goalTitle, detail: goalDetail, due_date: goalDueDate }) });
      setGoals(prev => [goal, ...prev]); setGoalTitle(''); setGoalDetail(''); setGoalDueDate(selectedDate || dateKey(new Date().toISOString())); setModal('');
      setToast('A new intention, set.');
    } catch (e) { setError(e.message); }
  }
  async function toggleGoal(goal) {
    try {
      const updated = await api(`/api/goals/${goal.id}`, { method: 'PATCH', body: JSON.stringify({ completed: !(Number(goal.completed) === 1 || goal.completed === true) }) });
      setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
    } catch (e) { setError(e.message); }
  }
  async function markGoalMissed(goal) {
    try {
      const updated = await api(`/api/goals/${goal.id}`, { method: 'PATCH', body: JSON.stringify({ missed: !(Number(goal.missed) === 1 || goal.missed === true) }) });
      setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
      setToast(updated.missed ? 'Marked as missed. You can try again.' : 'Task returned to your list.');
    } catch (e) { setError(e.message); }
  }
  async function deleteGoal(id) {
    try { await api(`/api/goals/${id}`, { method: 'DELETE' }); setGoals(prev => prev.filter(g => g.id !== id)); setToast('Goal removed.'); }
    catch (e) { setError(e.message); }
  }
  async function saveEntry(event) {
    event.preventDefault();
    if (!journalText.trim()) return;
    try {
      const entry = await api('/api/journal', { method: 'POST', body: JSON.stringify({ content: journalText, mood }) });
      setEntries(prev => [entry, ...prev]); setJournalText(''); setActiveTab('journal'); setToast('Thought saved.');
    } catch (e) { setError(e.message); }
  }
  async function deleteEntry(id) {
    try { await api(`/api/journal/${id}`, { method: 'DELETE' }); setEntries(prev => prev.filter(entry => entry.id !== id)); setToast('Entry deleted.'); }
    catch (e) { setError(e.message); }
  }
  function saveProfile(event) {
    event.preventDefault();
    const next = nameDraft.trim().slice(0, 40) || 'You';
    setProfileName(next); localStorage.setItem('mirror-name', next); setModal('');
    setToast('Your space, your rules.');
  }

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'goals', label: 'Intentions', icon: Target },
    { id: 'journal', label: 'Journal', icon: Feather },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays }
  ];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredGoals = goals.filter(g => `${g.title} ${g.detail || ''}`.toLowerCase().includes(normalizedSearch));
  const filteredEntries = entries.filter(e => `${e.content} ${e.mood}`.toLowerCase().includes(normalizedSearch));

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(calendarMonth);
  const activityDates = new Set([
    ...goals.map(g => g.due_date || dateKey(entryDate(g.created_at).toISOString())),
    ...entries.map(e => dateKey(e.created_at))
  ].filter(Boolean));
  const selectedEntries = entries.filter(e => dateKey(entryDate(e.created_at).toISOString()) === selectedDate);
  const selectedGoals = goals.filter(g => (g.due_date || dateKey(entryDate(g.created_at).toISOString())) === selectedDate);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Mirror home"><span className="brand-mark"><span /></span><span>MIRROR<span className="brand-period">.</span></span></a>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ id, label }) => <button key={id} className={activeTab === id ? 'nav-link active' : 'nav-link'} onClick={() => { setActiveTab(id); setSearch(''); document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }); }}>{label}</button>)}
        </nav>
        <button className="profile-pill" onClick={() => { setNameDraft(profileName); setModal('profile'); }} aria-label="Profile and appearance settings">
          <span className="avatar">{(profileName || 'Y').slice(0,1).toUpperCase()}</span><span className="profile-pill-name">{profileName}</span><Settings2 size={14} />
        </button>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-grain" />
          <div className="hero-copy">
            <div className="eyebrow light"><span className="eyebrow-line" /> A SPACE OF YOUR OWN</div>
            <h1>{greeting},<br /><span>come back to you.</span></h1>
            <p>A little space to pause, reflect, and move<br className="desktop-break" /> towards the person you want to become.</p>
            <a className="hero-cta" href="#workspace">Enter your space <ArrowDownRight size={16} /></a>
          </div>
          <div className="hero-art" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-caption"><span>FIG. 01</span><span>INWARD, ALWAYS</span></div></div>
          <div className="hero-bottom"><span>{dateLabel.toUpperCase()}</span><span>TAKE YOUR TIME <span className="tiny-star">✳</span></span></div>
        </section>

        <section className="workspace section-wrap" id="workspace">
          <div className="section-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR PERSONAL SPACE</div>
              <h2>{activeTab === 'goals' ? 'Your intentions.' : activeTab === 'journal' ? 'Your thoughts.' : activeTab === 'calendar' ? 'Your timeline.' : 'A little overview.'}</h2>
              <p className="section-subtitle">{activeTab === 'overview' ? `Welcome back, ${profileName}. Small steps count.` : 'A quiet place to keep track of what matters.'}</p></div>
            <div className="date-chip"><Clock3 size={14} /> {dateLabel}</div>
          </div>

          {error && <div className="error-banner">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}

          {activeTab === 'overview' && <>
            <div className="stats-grid">
              <article className="stat-card stat-dark"><div className="stat-top"><span>YOUR INTENTIONS</span><Target size={17} /></div><div className="stat-number">{String(goals.length).padStart(2,'0')}<span className="stat-unit"> goals</span></div><div className="stat-foot"><span>{completed} completed so far</span><span className="mini-arrow"><ArrowUpRight size={15} /></span></div></article>
              <article className="stat-card"><div className="stat-top"><span>YOUR MOMENTUM</span><Sparkles size={17} /></div><div className="stat-number">{progress}<span className="stat-unit">%</span></div><div className="progress-track"><span style={{width:`${progress}%`}} /></div><div className="stat-foot"><span>Overall goal progress</span><span className="progress-label">{progress === 100 && goals.length ? 'Complete' : 'In progress'}</span></div></article>
              <article className="stat-card stat-warm"><div className="stat-top"><span>PAUSE & REFLECT</span><Flower2 size={17} /></div><div className="stat-number">{String(entries.length).padStart(2,'0')}<span className="stat-unit"> notes</span></div><div className="stat-foot"><span>{latestEntry ? 'Last thought saved' : 'Your story starts here'}</span><span className="mini-arrow"><ArrowUpRight size={15} /></span></div></article>
            </div>
            <div className="content-grid">
              <section className="panel goals-panel"><div className="panel-heading"><div><span className="panel-kicker">01 / FOCUS</span><h3>Things that matter.</h3></div><button className="icon-button" onClick={() => setModal('goal')} aria-label="Add a goal"><Plus size={18}/></button></div>
                <div className="goal-list">{busy ? <p className="empty-state">Finding your space…</p> : goals.length === 0 ? <div className="empty-state"><span className="empty-icon"><Target size={20}/></span><p>No intentions yet.</p><span>Give something meaningful your attention.</span><button className="text-button" onClick={() => setModal('goal')}>Add your first goal <ArrowUpRight size={14}/></button></div> : goals.slice(0,5).map(goal => <GoalRow key={goal.id} goal={goal} onToggle={toggleGoal} onDelete={deleteGoal} onMissed={markGoalMissed}/>)}</div>
                {goals.length > 5 && <button className="panel-link" onClick={() => setActiveTab('goals')}>View all intentions <ArrowUpRight size={14}/></button>}
              </section>
              <section className="panel journal-panel"><div className="panel-heading"><div><span className="panel-kicker">02 / REFLECTION</span><h3>Clear your mind.</h3></div><span className="journal-spark">✳</span></div>
                <form onSubmit={saveEntry} className="quick-journal"><label htmlFor="quick-note">What's on your mind today?</label><textarea id="quick-note" value={journalText} onChange={e=>setJournalText(e.target.value)} placeholder="Start anywhere. It doesn't have to be perfect…" rows="4" maxLength="5000"/><div className="journal-form-bottom"><select value={mood} onChange={e=>setMood(e.target.value)} aria-label="Current mood">{moods.map(m=><option key={m}>{m}</option>)}</select><button className="button-dark" type="submit" disabled={!journalText.trim()}>Save thought <ArrowUpRight size={14}/></button></div></form>
                {latestEntry && <button className="latest-note" onClick={()=>setActiveTab('journal')}><span className="latest-note-label">LATEST NOTE · {latestEntry.mood.toUpperCase()}</span><span>{latestEntry.content.slice(0,94)}{latestEntry.content.length>94?'…':''}</span><ArrowUpRight size={15}/></button>}
              </section>
            </div>
            <div className="weekly-strip"><div className="weekly-icon"><Sparkles size={17}/></div><div className="weekly-copy"><strong>Your last 7 days</strong><span>A gentle look at the activity you've logged.</span></div><div className="weekly-metric"><strong>{recentEntries}</strong><span>journal notes</span></div><div className="weekly-metric"><strong>{recentCompleted}</strong><span>goals completed</span></div><button className="text-button" onClick={()=>setActiveTab('calendar')}>View calendar <ArrowUpRight size={14}/></button></div>
          </>}

          {activeTab === 'goals' && <section className="panel full-panel"><div className="panel-heading"><div><span className="panel-kicker">YOUR DIRECTION</span><h3>Intentions, not pressure.</h3></div><button className="button-dark" onClick={()=>setModal('goal')}><Plus size={15}/> New intention</button></div>
            <div className="search-field"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your intentions…" aria-label="Search goals"/>{search && <button onClick={()=>setSearch('')} aria-label="Clear search"><X size={14}/></button>}</div>
            {filteredGoals.length ? <div className="goal-list">{filteredGoals.map(goal=><GoalRow key={goal.id} goal={goal} onToggle={toggleGoal} onDelete={deleteGoal} onMissed={markGoalMissed}/>)}</div> : <div className="empty-state roomy"><span className="empty-icon"><Target size={20}/></span><p>{search?'No matching intentions.':'Make room for something meaningful.'}</p><span>{search?'Try another search term.':'Add a goal to begin.'}</span>{!search && <button className="text-button" onClick={()=>setModal('goal')}>Create an intention <ArrowUpRight size={14}/></button>}</div>}
          </section>}

          {activeTab === 'journal' && <section className="panel full-panel journal-full"><div className="panel-heading"><div><span className="panel-kicker">YOUR INNER WORLD</span><h3>A place to put it all down.</h3></div><span className="journal-spark">✳</span></div>
            <form onSubmit={saveEntry} className="full-journal-form"><textarea value={journalText} onChange={e=>setJournalText(e.target.value)} placeholder="Dear me, today I'm thinking about…" rows="5" maxLength="5000" aria-label="Journal entry"/><div className="journal-form-bottom"><select value={mood} onChange={e=>setMood(e.target.value)} aria-label="Entry mood">{moods.map(m=><option key={m}>{m}</option>)}</select><button className="button-dark" type="submit" disabled={!journalText.trim()}>Save entry <ArrowUpRight size={14}/></button></div></form>
            <div className="search-field journal-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your thoughts or moods…" aria-label="Search journal entries"/>{search && <button onClick={()=>setSearch('')} aria-label="Clear search"><X size={14}/></button>}</div>
            <div className="entry-list">{filteredEntries.length ? filteredEntries.map(entry=><article className="entry-card" key={entry.id}><div className="entry-meta"><span>{entryDate(entry.created_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</span><span className="mood-tag">{entry.mood}</span><button className="delete-button" onClick={()=>deleteEntry(entry.id)} aria-label="Delete entry"><Trash2 size={14}/></button></div><p>{entry.content}</p></article>) : <div className="empty-state roomy"><span className="empty-icon"><Feather size={20}/></span><p>{search?'No matching entries.':'Your thoughts are yours alone.'}</p><span>{search?'Try another search term.':'Write your first entry above.'}</span></div>}</div>
          </section>}

          {activeTab === 'calendar' && <section className="calendar-layout">
            <div className="panel calendar-panel"><div className="calendar-top"><div><span className="panel-kicker">YOUR ACTIVITY</span><h3>{monthLabel}</h3></div><div className="calendar-arrows"><button className="icon-button" onClick={()=>setCalendarMonth(new Date(year,month-1,1))} aria-label="Previous month"><ChevronLeft size={17}/></button><button className="icon-button" onClick={()=>setCalendarMonth(new Date(year,month+1,1))} aria-label="Next month"><ChevronRight size={17}/></button></div></div>
              <div className="calendar-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span className="calendar-weekday" key={d}>{d}</span>)}{Array.from({length:firstDay},(_,i)=><span className="calendar-blank" key={`blank-${i}`}/>)}{Array.from({length:daysInMonth},(_,i)=>{const day=i+1;const key=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const isToday=key===dateKey(new Date().toISOString());return <button key={key} className={`calendar-day ${isToday?'is-today':''} ${selectedDate===key?'is-selected':''}`} onClick={()=>setSelectedDate(key)}>{day}{activityDates.has(key)&&<i/>}</button>})}</div>
              <div className="calendar-legend"><span><i className="legend-dot"/> Activity saved</span><span>Choose a day to review</span></div>
            </div>
            <div className="panel day-panel"><span className="panel-kicker">DAY IN REVIEW</span><h3>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'})}</h3><p className="day-panel-sub">What you saved on this day.</p>
              {selectedGoals.length===0 && selectedEntries.length===0 ? <div className="empty-state"><span className="empty-icon"><CalendarDays size={20}/></span><p>A little breathing room.</p><span>No goals or journal entries saved on this day.</span></div> : <div className="day-activity">{selectedGoals.map(g=><div className="day-item" key={`g-${g.id}`}><Target size={15}/><div><strong>{g.title}</strong><span>{g.completed ? 'Completed' : g.missed ? 'Marked as missed' : g.due_date && g.due_date < dateKey(new Date().toISOString()) ? 'Overdue — not completed' : 'Task due this day'}{g.detail ? ` · ${g.detail}` : ''}</span></div></div>)}{selectedEntries.map(e=><div className="day-item" key={`e-${e.id}`}><Feather size={15}/><div><strong>{e.mood} reflection</strong><span>{e.content.slice(0,100)}{e.content.length>100?'…':''}</span></div></div>)}</div>}
            </div>
          </section>}
        </section>

        <section className="closing section-wrap"><span className="closing-star">✳</span><p>You don't have to have it all figured out.</p><h2>Just keep showing up<br/><em>for yourself.</em></h2><span className="closing-foot">A REMINDER FROM MIRROR, TO YOU.</span></section>
      </main>
      <footer className="footer"><a className="brand footer-brand" href="#top"><span className="brand-mark"><span/></span><span>MIRROR<span className="brand-period">.</span></span></a><span>MADE FOR THE PERSON YOU'RE BECOMING.</span><a href="#top" className="back-top">BACK TO TOP ↑</a></footer>

      {modal==='goal' && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal('');}}><form className="goal-modal" onSubmit={addGoal}><div className="modal-top"><span className="panel-kicker">A NEW INTENTION</span><button type="button" className="icon-button" onClick={()=>setModal('')} aria-label="Close"><X size={17}/></button></div><h3>What matters to you?</h3><p>Keep it simple. Start with one thing.</p><label htmlFor="goal-title">Goal</label><input id="goal-title" autoFocus value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} placeholder="e.g. Make time to read" maxLength="120" required/><label htmlFor="goal-detail">A little more (optional)</label><textarea id="goal-detail" value={goalDetail} onChange={e=>setGoalDetail(e.target.value)} placeholder="Why is this important to you?" rows="3" maxLength="300"/><label htmlFor="goal-due-date">When should this be done?</label><input id="goal-due-date" type="date" value={goalDueDate} onChange={e=>setGoalDueDate(e.target.value)} required/><button className="button-dark modal-submit" type="submit"><Plus size={15}/> Add intention</button></form></div>}

      {modal==='profile' && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal('');}}><form className="goal-modal settings-modal" onSubmit={saveProfile}><div className="modal-top"><span className="panel-kicker">MAKE IT YOURS</span><button type="button" className="icon-button" onClick={()=>setModal('')} aria-label="Close"><X size={17}/></button></div><div className="settings-title-icon"><UserRound size={19}/></div><h3>Your space, your way.</h3><p>Personalise the little details.</p><label htmlFor="profile-name">What should we call you?</label><input id="profile-name" value={nameDraft} onChange={e=>setNameDraft(e.target.value)} maxLength="40" placeholder="Your name"/><label>Accent colour</label><div className="theme-options">{themes.map(t=><button type="button" key={t.id} className={`theme-option ${theme===t.id?'selected':''}`} onClick={()=>setTheme(t.id)} aria-label={`${t.label} theme`} title={t.label}><span style={{background:t.color}}/><small>{t.label}</small></button>)}</div><button className="button-dark modal-submit" type="submit">Save preferences <ArrowUpRight size={14}/></button></form></div>}
      {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
    </div>
  );
}

function GoalRow({goal,onToggle,onDelete,onMissed}) {
  const isDone = Number(goal.completed)===1 || goal.completed===true;
  const isMissed = Number(goal.missed)===1 || goal.missed===true;
  const today = dateKey(new Date().toISOString());
  const overdue = !isDone && !isMissed && goal.due_date && goal.due_date < today;
  const status = isDone ? 'Completed' : isMissed ? 'Missed' : overdue ? 'Overdue' : goal.due_date ? `Due ${new Date(`${goal.due_date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}` : 'No due date';
  return <div className={`goal-row ${isDone?'goal-complete':''} ${isMissed?'goal-missed':''} ${overdue?'goal-overdue':''}`}>
    <button className="goal-check" onClick={()=>onToggle(goal)} aria-label={isDone?'Mark goal incomplete':'Complete goal'}>{isDone?<CheckCircle2 size={19}/>:<Circle size={19}/>}</button>
    <button className="goal-copy" onClick={()=>onToggle(goal)}><span>{goal.title}</span>{goal.detail&&<small>{goal.detail}</small>}<small className="goal-status">{status}</small></button>
    {!isDone && !isMissed && <button className="missed-button" onClick={()=>onMissed(goal)} title="Mark as missed">Mark missed</button>}
    {isMissed && <button className="missed-button" onClick={()=>onMissed(goal)} title="Put back into active tasks">Retry</button>}
    <button className="delete-button" onClick={()=>onDelete(goal.id)} aria-label="Delete goal"><Trash2 size={14}/></button>
  </div>;
}
export default App;
