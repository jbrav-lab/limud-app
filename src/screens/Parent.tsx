import { useRef, useState } from 'react';
import { Expression, MathText } from '../components/MathText';
import { actions, childProgress, mastery, today, topicProgress, useData } from '../engine/store';
import { PACKS, gradeLabel, packInfo, topicById } from '../curricula';
import type { Pack } from '../curricula/types';
import { WithPacks } from './Subjects';
import { Stars } from './Home';
import { DIFFICULTIES, verbalGrade } from '../engine/exam';
import { ProfileForm } from './Profiles';

function PinGate({ onOk, onBack }: { onOk: () => void; onBack: () => void }) {
  const data = useData();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const creating = !data.parentPin;

  return (
    <div className="screen pin">
      <header className="subbar">
        <button className="back" onClick={onBack} aria-label="חזרה">
          →
        </button>
        <h1>🔒 אזור הורים</h1>
      </header>
      <div className="card form">
        <p>{creating ? 'בחרו קוד בן 4 ספרות. הקוד שומר שהילדים לא ייכנסו לאזור ההורים.' : 'הקלידו את קוד ההורים'}</p>
        <input className="pin-input" dir="ltr" inputMode="numeric" type="password" maxLength={4} value={pin} autoFocus onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
        {creating && <input className="pin-input" dir="ltr" inputMode="numeric" type="password" maxLength={4} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} placeholder="שוב" />}
        {err && <p className="note">{err}</p>}
        <button
          className="btn primary"
          disabled={pin.length !== 4}
          onClick={() => {
            if (creating) {
              if (pin !== pin2) return setErr('הקודים לא תואמים');
              actions.setPin(pin);
              onOk();
            } else if (pin === data.parentPin) onOk();
            else {
              setErr('קוד שגוי');
              setPin('');
            }
          }}
        >
          {creating ? 'שמירת קוד' : 'כניסה'}
        </button>
      </div>
    </div>
  );
}

const fmtDate = (t: number) => (t ? new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '—');

function ChildReport({ pid, allPacks }: { pid: string; allPacks: Pack[] }) {
  const data = useData();
  const c = childProgress(data, pid);
  const grade = data.profiles.find((p) => p.id === pid)?.grade;
  // The child's grade subjects, plus any other subject they have progress in (e.g. after a grade change).
  const packs = allPacks.filter((p) => p.grade === grade || p.topics.some((t) => c.topics[t.id]));
  const tps = packs.flatMap((p) => p.topics).map((t) => ({ t, tp: topicProgress(data, pid, t.id) }));
  const attempts = tps.reduce((s, x) => s + x.tp.attempts, 0);
  const first = tps.reduce((s, x) => s + x.tp.firstTry, 0);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { label: d.toLocaleDateString('he-IL', { weekday: 'narrow' }), n: c.daily[today(d)] ?? 0 };
  });
  const maxDay = Math.max(5, ...last7.map((d) => d.n));
  const weak = tps
    .filter((x) => x.tp.attempts >= 6 && x.tp.firstTry / x.tp.attempts < 0.6)
    .sort((a, b) => a.tp.firstTry / a.tp.attempts - b.tp.firstTry / b.tp.attempts)
    .slice(0, 3);
  const notStarted = tps.filter((x) => x.tp.attempts === 0);

  return (
    <>
      <div className="card summary-card">
        <div className="stat">
          <b>{attempts}</b>
          <span>שאלות</span>
        </div>
        <div className="stat">
          <b>{attempts ? Math.round((first / attempts) * 100) : 0}%</b>
          <span>נכון בניסיון ראשון</span>
        </div>
        <div className="stat">
          <b>🔥 {c.streakDays}</b>
          <span>ימים ברצף</span>
        </div>
        <div className="stat">
          <b>⭐ {c.stars}</b>
          <span>כוכבים</span>
        </div>
      </div>

      <div className="card">
        <h3>פעילות ב-7 הימים האחרונים</h3>
        <div className="week">
          {last7.map((d, i) => (
            <div key={i} className="day">
              <div className="dbar" style={{ height: `${(d.n / maxDay) * 70}px` }} title={`${d.n}`} />
              <span className="dn">{d.n || ''}</span>
              <span className="dl">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>📝 מבחנים</h3>
        {!c.exams?.length && <p className="muted">עוד לא נעשו מבחנים.</p>}
        {!!c.exams?.length && (
          <table className="report">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>מקצוע</th>
                <th>ציון</th>
                <th>נכונות</th>
                <th>רמה</th>
                <th>נושאים</th>
              </tr>
            </thead>
            <tbody>
              {c.exams.slice(0, 10).map((e, i) => (
                <tr key={i} className={e.score < 55 ? 'weak' : ''}>
                  <td>{fmtDate(e.at)}</td>
                  <td>{packInfo(e.packId)?.emoji ?? ''}</td>
                  <td>
                    <b>{e.score}</b> <span className="muted">{verbalGrade(e.score).label}</span>
                  </td>
                  <td>
                    {e.correct}/{e.questions}
                  </td>
                  <td>{DIFFICULTIES.find((d) => d.id === e.difficulty)?.label ?? e.difficulty}</td>
                  <td className="small-text">{e.topicIds.length > 3 ? `${e.topicIds.length} נושאים` : e.topicIds.map((id) => topicById(id)?.title).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(weak.length > 0 || notStarted.length > 0) && (
        <div className="card focus">
          <h3>🎯 כדאי להתמקד</h3>
          {weak.map(({ t, tp }) => (
            <p key={t.id}>
              {t.emoji} <b>{t.title}</b> – רק {Math.round((tp.firstTry / tp.attempts) * 100)}% נכון בניסיון ראשון
            </p>
          ))}
          {notStarted.length > 0 && <p className="muted">עוד לא תורגלו: {notStarted.map((x) => x.t.title).join(' · ')}</p>}
        </div>
      )}

      {packs.length === 0 && <p className="muted center">עוד אין מקצועות ל{gradeLabel(grade ?? 0)}.</p>}
      {packs.flatMap((p) => [
        <h2 key={p.id} className="pack-title">
          {p.emoji} {p.title} <span className="muted small-text">{gradeLabel(p.grade)}</span>
        </h2>,
        ...p.units.map((u) => (
        <div key={u.id} className="card">
          <h3 style={{ color: u.color }}>{u.title}</h3>
          <table className="report">
            <thead>
              <tr>
                <th>נושא</th>
                <th>שליטה</th>
                <th>רמה</th>
                <th>שאלות</th>
                <th>הצלחה</th>
                <th>אחרון</th>
              </tr>
            </thead>
            <tbody>
              {tps
                .filter((x) => x.t.unit === u.id)
                .map(({ t, tp }) => {
                  const pct = tp.attempts ? Math.round(((tp.firstTry + tp.secondTry * 0.5) / tp.attempts) * 100) : null;
                  return (
                    <tr key={t.id} className={pct !== null && pct < 60 && tp.attempts >= 6 ? 'weak' : ''}>
                      <td>
                        {t.emoji} {t.title}
                      </td>
                      <td>
                        <Stars n={mastery(tp)} />
                      </td>
                      <td>{tp.attempts ? tp.level : '—'}</td>
                      <td>{tp.attempts}</td>
                      <td>{pct === null ? '—' : `${pct}%`}</td>
                      <td>{fmtDate(tp.lastAt)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        )),
      ])}
      <p className="footnote">"הצלחה" = נכון בניסיון ראשון, ונכון אחרי רמז נספר כחצי.</p>

      <div className="card">
        <h3>טעויות אחרונות</h3>
        {c.mistakes.length === 0 && <p className="muted">אין עדיין טעויות 🙂</p>}
        <ul className="mistakes">
          {c.mistakes.slice(0, 20).map((m, i) => (
            <li key={i}>
              <div className="mmeta">
                {topicById(m.topicId)?.emoji} {topicById(m.topicId)?.title} · {fmtDate(m.at)}
              </div>
              <MathText text={m.prompt} />
              {m.expression && <Expression text={m.expression} />}
              <div className="mans">
                ענה/תה: <span className="bad"><MathText text={m.given} /></span> · נכון: <span className="good"><MathText text={m.correct} /></span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function Parent({ onBack }: { onBack: () => void }) {
  const data = useData();
  const [ok, setOk] = useState(false);
  const [sel, setSel] = useState<string | 'settings'>(data.profiles[0]?.id ?? 'settings');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [newPin, setNewPin] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ok) return <PinGate onOk={() => setOk(true)} onBack={onBack} />;

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `limud-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="screen parent">
      <header className="subbar">
        <button className="back" onClick={onBack} aria-label="חזרה">
          →
        </button>
        <h1>אזור הורים</h1>
      </header>
      <nav className="tabs">
        {data.profiles.map((p) => (
          <button key={p.id} className={sel === p.id ? 'on' : ''} onClick={() => setSel(p.id)}>
            {p.avatar} {p.name}
          </button>
        ))}
        <button className={sel === 'settings' ? 'on' : ''} onClick={() => setSel('settings')}>
          ⚙️ הגדרות
        </button>
      </nav>

      {sel !== 'settings' && data.profiles.some((p) => p.id === sel) && (
        <WithPacks ids={PACKS.map((p) => p.id)}>{(packs) => <ChildReport pid={sel} allPacks={packs} />}</WithPacks>
      )}

      {sel === 'settings' && (
        <>
          <div className="card">
            <h3>ילדים</h3>
            {data.profiles.map((p) =>
              editing === p.id ? (
                <ProfileForm
                  key={p.id}
                  initial={p}
                  onDone={(fields) => {
                    actions.editProfile(p.id, fields);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div key={p.id} className="kid-row">
                  <span>
                    {p.avatar} {p.name} <span className="muted small-text">· {gradeLabel(p.grade)}</span>
                  </span>
                  <span className="row">
                    <button className="link small" onClick={() => setEditing(p.id)}>
                      עריכה
                    </button>
                    <button
                      className="link small"
                      onClick={() => {
                        if (confirm(`לאפס את כל ההתקדמות של ${p.name}? אי אפשר לבטל.`)) actions.resetProgress(p.id);
                      }}
                    >
                      איפוס התקדמות
                    </button>
                    <button
                      className="link small danger"
                      onClick={() => {
                        if (confirm(`למחוק את ${p.name} ואת כל ההתקדמות? אי אפשר לבטל.`)) actions.deleteProfile(p.id);
                      }}
                    >
                      מחיקה
                    </button>
                  </span>
                </div>
              ),
            )}
            {editing === 'new' ? (
              <ProfileForm
                onDone={(fields) => {
                  actions.addProfile(fields);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <button className="btn ghost" onClick={() => setEditing('new')}>
                ➕ הוספת ילד/ה
              </button>
            )}
          </div>

          <div className="card">
            <h3>צלילים</h3>
            <label className="toggle">
              <input type="checkbox" checked={data.sound} onChange={(e) => actions.setSound(e.target.checked)} /> צלילי משוב
            </label>
          </div>

          <div className="card">
            <h3>החלפת קוד הורים</h3>
            <div className="row">
              <input className="pin-input" dir="ltr" inputMode="numeric" type="password" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="קוד חדש" />
              <button
                className="btn ghost"
                disabled={newPin.length !== 4}
                onClick={() => {
                  actions.setPin(newPin);
                  setNewPin('');
                  setMsg('הקוד עודכן ✓');
                }}
              >
                עדכון
              </button>
            </div>
          </div>

          <div className="card">
            <h3>גיבוי</h3>
            <p className="muted">ההתקדמות נשמרת רק במכשיר הזה. כדאי לשמור גיבוי מדי פעם.</p>
            <div className="row">
              <button className="btn ghost" onClick={exportData}>
                ⬇️ שמירת גיבוי
              </button>
              <button className="btn ghost" onClick={() => fileRef.current?.click()}>
                ⬆️ שחזור מגיבוי
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    if (!confirm('השחזור יחליף את כל הנתונים הנוכחיים. להמשיך?')) return;
                    actions.importData(await f.text());
                    setMsg('הגיבוי שוחזר ✓');
                  } catch {
                    setMsg('הקובץ לא תקין');
                  }
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          {msg && <p className="note">{msg}</p>}
        </>
      )}
    </div>
  );
}
