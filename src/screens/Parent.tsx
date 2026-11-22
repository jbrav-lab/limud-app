import { useEffect, useRef, useState } from 'react';
import { Expression, MathText } from '../components/MathText';
import { actions, childProgress, deriveTotals, emptyChild, emptyTopic, mastery, today, useData, type ChildProgress, type TopicProgress } from '../engine/store';
import { mergeChild } from '../engine/merge';
import { parentSignedIn, useRemoteChildren, useRemoteProgress } from '../sync/useRemote';
import { MAX_BACKUP_BYTES, backupJson, readBackup } from '../engine/backup';
import { iosNotInstalled } from '../engine/device';
import { FamilySync } from './FamilySync';
import { syncEnabled } from '../sync/client';
import { pinResetAllowed, signInWithGoogle, takePinResetReturn } from '../sync/family';
import { PACKS, dirClass, gradeLabel, packInfo, topicById } from '../curricula';
import type { Pack } from '../curricula/types';
import { WithPacks } from './Subjects';
import { ParentTestsPanel } from './ParentTests';
import { Stars } from './Home';
import { DIFFICULTIES, verbalGrade } from '../engine/exam';
import { ProfileForm } from './Profiles';

/** The parent PIN: 4 to 6 digits (owner, 2026-11-19). */
const PIN_MIN = 4;
const PIN_MAX = 6;
const pinOk = (pin: string) => /^\d+$/.test(pin) && pin.length >= PIN_MIN && pin.length <= PIN_MAX;
const digits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_MAX);

/**
 * The parent PIN gate. A forgotten PIN is reset by signing in again with Google (owner's choice A,
 * 2026-11-19): a fresh sign-in, by a parent in a family, and of this device's family if it is paired.
 * Nobody, the admin included, can reset another parent's PIN.
 */
function PinGate({ onOk, onBack }: { onOk: () => void; onBack: () => void }) {
  const data = useData();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const [reset, setReset] = useState<'no' | 'ask' | 'checking' | 'new'>('no');
  useEffect(() => {
    if (!takePinResetReturn()) return;
    setReset('checking');
    pinResetAllowed()
      .then((r) => {
        if (r === 'ok') return setReset('new');
        setReset('no');
        setErr(
          r === 'stale'
            ? 'לא הייתה התחברות חדשה עם Google. נסו שוב.'
            : r === 'no-family'
              ? 'החשבון הזה לא שייך למשפחה, ולכן אי אפשר לאפס בו את הקוד.'
              : 'החשבון הזה לא שייך למשפחה של המכשיר הזה.',
        );
      })
      .catch(() => {
        setReset('no');
        setErr('הבדיקה נכשלה. בדקו את החיבור לאינטרנט ונסו שוב.');
      });
  }, []);
  const creating = !data.parentPin || reset === 'new';
  if (reset === 'ask' || reset === 'checking') {
    return (
      <div className="screen pin">
        <header className="subbar">
          <button className="back" onClick={() => setReset('no')} aria-label="חזרה">
            →
          </button>
          <h1>🔒 שכחתי את הקוד</h1>
        </header>
        <div className="card form">
          {reset === 'checking' ? (
            <p>בודקים את ההתחברות…</p>
          ) : (
            <>
              <p>כדי לבחור קוד חדש, התחברו מחדש עם חשבון Google של הורה במשפחה. Google יבקש את הסיסמה שוב, גם אם כבר התחברתם.</p>
              <button className="btn primary" onClick={() => signInWithGoogle('pin-reset').catch(() => setErr('ההתחברות נכשלה. נסו שוב.'))}>
                התחברות עם Google
              </button>
              {err && <p className="note">{err}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen pin">
      <header className="subbar">
        <button className="back" onClick={onBack} aria-label="חזרה">
          →
        </button>
        <h1>🔒 אזור הורים</h1>
      </header>
      <div className="card form">
        <p>{reset === 'new' ? 'ההתחברות אושרה ✓ בחרו קוד חדש של 4 עד 6 ספרות.' : creating ? 'בחרו קוד של 4 עד 6 ספרות. הקוד שומר שהילדים לא ייכנסו לאזור ההורים.' : 'הקלידו את קוד ההורים'}</p>
        <input className="pin-input" dir="ltr" inputMode="numeric" type="password" maxLength={PIN_MAX} value={pin} autoFocus onChange={(e) => setPin(digits(e.target.value))} placeholder="••••" />
        {creating && <input className="pin-input" dir="ltr" inputMode="numeric" type="password" maxLength={PIN_MAX} value={pin2} onChange={(e) => setPin2(digits(e.target.value))} placeholder="שוב" />}
        {err && <p className="note">{err}</p>}
        <button
          className="btn primary"
          disabled={!pinOk(pin)}
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
        {!creating && syncEnabled() && (
          <button
            className="btn ghost"
            onClick={() => {
              setErr('');
              setReset('ask');
            }}
          >
            שכחתי את הקוד
          </button>
        )}
      </div>
    </div>
  );
}

const fmtDate = (t: number) => (t ? new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '—');

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return 'עכשיו';
  if (m < 60) return `לפני ${m} דקות`;
  if (m < 24 * 60) return `לפני ${Math.round(m / 60)} שעות`;
  return new Date(t).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * A child's report: this phone's own data, plus (Stage 4) what the child's paired devices uploaded,
 * when a parent is signed in. Both are merged the same way two devices merge, so nothing counts twice.
 */
function ChildTab({ pid, grade, name, allPacks }: { pid: string; grade?: number; name: string; allPacks: Pack[] }) {
  const data = useData();
  const remote = useRemoteProgress(pid);
  const local = data.progress[pid];
  let c = childProgress(data, pid);
  if (remote.data && remote.data.updatedAt) {
    const merged = mergeChild(local ?? emptyChild(), { ...remote.data.child, ...(local?.resetAt ? { resetAt: local.resetAt } : {}) });
    c = { ...merged, ...deriveTotals(merged) };
  }
  return (
    <>
      {remote.state !== 'off' && (
        <div className="card remote-line">
          {remote.state === 'loading' && <span className="muted">🌐 טוען נתונים מהשרת…</span>}
          {remote.state === 'error' && <span className="muted">🌐 לא הצלחנו לטעון מהשרת. בדקו את החיבור.</span>}
          {remote.state === 'ok' &&
            (remote.data?.updatedAt ? (
              <span>
                🌐 כולל נתונים מהטלפון של {name} · עודכן {ago(remote.data.updatedAt)}
              </span>
            ) : (
              <span className="muted">🌐 עוד אין נתונים בשרת מטלפון מחובר.</span>
            ))}{' '}
          <button className="btn ghost" onClick={remote.reload} disabled={remote.state === 'loading'}>
            רענון
          </button>
        </div>
      )}
      {remote.state !== 'off' && <ParentTestsPanel childId={pid} grade={grade} name={name} packs={allPacks} levelOf={(id) => c.topics[id]?.level ?? 1} />}
      <ChildReport c={c} grade={grade} allPacks={allPacks} />
    </>
  );
}

function ChildReport({ c, grade, allPacks }: { c: ChildProgress; grade?: number; allPacks: Pack[] }) {
  // The child's grade subjects, plus any other subject they have progress in (e.g. after a grade change).
  const packs = allPacks.filter((p) => p.grade === grade || p.topics.some((t) => c.topics[t.id]));
  const tps = packs.flatMap((p) => p.topics).map((t) => ({ t, tp: c.topics[t.id] ?? emptyTopic() }));
  const attempts = tps.reduce((s, x) => s + x.tp.attempts, 0);
  const first = tps.reduce((s, x) => s + x.tp.firstTry, 0);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { label: d.toLocaleDateString('he-IL', { weekday: 'narrow' }), n: c.daily[today(d)] ?? 0 };
  });
  const maxDay = Math.max(5, ...last7.map((d) => d.n));
  // Per subject: its topics, what was practised, what needs work, and its own recent mistakes (owner, 2026-11-20).
  const isWeak = (tp: TopicProgress) => tp.attempts >= 6 && tp.firstTry / tp.attempts < 0.6;
  const rate = (tp: TopicProgress) => tp.firstTry / tp.attempts;
  const subjects = packs.map((p) => {
    const items = p.topics.map((t) => ({ t, tp: c.topics[t.id] ?? emptyTopic() }));
    const ids = new Set(p.topics.map((t) => t.id));
    return {
      p,
      items,
      attempts: items.reduce((s, x) => s + x.tp.attempts, 0),
      first: items.reduce((s, x) => s + x.tp.firstTry, 0),
      practised: items.filter((x) => x.tp.attempts > 0).length,
      lastAt: Math.max(0, ...items.map((x) => x.tp.lastAt || 0)),
      weak: items.filter((x) => isWeak(x.tp)).sort((a, b) => rate(a.tp) - rate(b.tp)),
      notStarted: items.filter((x) => x.tp.attempts === 0),
      mistakes: c.mistakes.filter((m) => ids.has(m.topicId)),
    };
  });
  const weakCount = subjects.reduce((s, x) => s + x.weak.length, 0);
  const notStartedCount = subjects.reduce((s, x) => s + x.notStarted.length, 0);
  const otherMistakes = c.mistakes.filter((m) => !packs.some((p) => p.topics.some((t) => t.id === m.topicId)));

  const mistakeList = (ms: typeof c.mistakes) => (
    <ul className="mistakes">
      {ms.slice(0, 20).map((m, i) => (
        <li key={i} className={dirClass(m.topicId)}>
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
  );

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

      <details className="card fold focus">
        <summary>
          <h3>🎯 כדאי להתמקד</h3>
          <span className="fold-count">{weakCount ? `${weakCount} נושאים` : 'אין כרגע'}</span>
        </summary>
        {weakCount === 0 && <p className="muted">אין נושא שתורגל ועדיין קשה. נושאים שעוד לא תורגלו מופיעים ב„עוד לא בוצע”.</p>}
        {subjects
          .filter((s) => s.weak.length)
          .map((s) => (
            <details key={s.p.id} className="fold inner">
              <summary>
                <b>
                  {s.p.emoji} {s.p.title}
                </b>
                <span className="fold-count">{s.weak.length}</span>
              </summary>
              {s.weak.map(({ t, tp }) => (
                <p key={t.id}>
                  {t.emoji} <b>{t.title}</b> – רק {Math.round(rate(tp) * 100)}% נכון בניסיון ראשון
                </p>
              ))}
            </details>
          ))}
      </details>

      {notStartedCount > 0 && (
        <details className="card fold">
          <summary>
            <h3>⏳ עוד לא בוצע</h3>
            <span className="fold-count">{notStartedCount} נושאים</span>
          </summary>
          {subjects
            .filter((s) => s.notStarted.length)
            .map((s) => (
              <details key={s.p.id} className="fold inner">
                <summary>
                  <b>
                    {s.p.emoji} {s.p.title}
                  </b>
                  <span className="fold-count">
                    {s.notStarted.length} מתוך {s.items.length}
                  </span>
                </summary>
                <p className="muted">{s.notStarted.map((x) => x.t.title).join(' · ')}</p>
              </details>
            ))}
        </details>
      )}

      {packs.length === 0 && <p className="muted center">עוד אין מקצועות ל{gradeLabel(grade ?? 0)}.</p>}
      {subjects.map((s) => (
        <details key={s.p.id} className="card fold subject">
          <summary>
            <h3>
              {s.p.emoji} {s.p.title} <span className="muted small-text">{gradeLabel(s.p.grade)}</span>
            </h3>
            <span className="fold-count">{s.attempts ? `${Math.round((s.first / s.attempts) * 100)}% · ${s.attempts} שאלות` : 'עוד לא תורגל'}</span>
          </summary>
          <div className="summary-card subject-overview">
            <div className="stat">
              <b>{s.attempts}</b>
              <span>שאלות</span>
            </div>
            <div className="stat">
              <b>{s.attempts ? Math.round((s.first / s.attempts) * 100) : 0}%</b>
              <span>נכון בניסיון ראשון</span>
            </div>
            <div className="stat">
              <b>
                {s.practised}/{s.items.length}
              </b>
              <span>נושאים תורגלו</span>
            </div>
            <div className="stat">
              <b>{fmtDate(s.lastAt)}</b>
              <span>תרגול אחרון</span>
            </div>
          </div>
          {s.weak.length > 0 && <p className="subject-focus">🎯 כדאי להתמקד: {s.weak.map(({ t }) => t.title).join(' · ')}</p>}
          {s.p.units.map((u) => (
            <div key={u.id} className="subject-unit">
              <h4 style={{ color: u.color }}>{u.title}</h4>
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
                  {s.items
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
          ))}
          <details className="fold inner">
            <summary>
              <b>טעויות אחרונות</b>
              <span className="fold-count">{s.mistakes.length || 'אין'}</span>
            </summary>
            {s.mistakes.length === 0 ? <p className="muted">אין עדיין טעויות במקצוע הזה 🙂</p> : mistakeList(s.mistakes)}
          </details>
        </details>
      ))}
      {otherMistakes.length > 0 && (
        <details className="card fold">
          <summary>
            <h3>טעויות במקצועות אחרים</h3>
            <span className="fold-count">{otherMistakes.length}</span>
          </summary>
          {mistakeList(otherMistakes)}
        </details>
      )}
      <p className="footnote">"הצלחה" = נכון בניסיון ראשון, ונכון אחרי רמז נספר כחצי.</p>
    </>
  );
}

export function Parent({ onBack }: { onBack: () => void }) {
  const data = useData();
  const [ok, setOk] = useState(false);
  const [sel, setSel] = useState<string | 'settings'>(data.profiles[0]?.id ?? 'settings');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Family children that aren't on this phone (for example on a second parent's phone), from the server.
  const remoteKids = useRemoteChildren(ok);
  // The sign-in notice's button: open Settings, then (once rendered) scroll to the family card.
  const [toFamily, setToFamily] = useState(false);
  useEffect(() => {
    if (!toFamily || sel !== 'settings') return;
    // A moment later: the settings cards are still laying out right after the switch.
    const t = setTimeout(() => {
      setToFamily(false);
      document.getElementById('family-sync')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => clearTimeout(t);
  }, [toFamily, sel]);

  if (!ok) return <PinGate onOk={() => setOk(true)} onBack={onBack} />;

  const remoteOnly = remoteKids.filter((k) => !data.profiles.some((p) => p.id === k.id) && !data.deleted[k.id]);
  const selKid = data.profiles.find((p) => p.id === sel) ?? remoteOnly.find((k) => k.id === sel);

  const exportData = () => {
    const blob = new Blob([backupJson(data)], { type: 'application/json' });
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
        {remoteOnly.map((k) => (
          <button key={k.id} className={sel === k.id ? 'on' : ''} onClick={() => setSel(k.id)}>
            {k.avatar} {k.name} 🌐
          </button>
        ))}
        <button className={sel === 'settings' ? 'on' : ''} onClick={() => setSel('settings')}>
          ⚙️ הגדרות
        </button>
      </nav>

      {sel !== 'settings' && syncEnabled() && !parentSignedIn() && (
        <div className="card remote-line signin-hint">
          <span>
            🌐 בטלפון הזה לא התחברתם עם Google, ולכן לא רואים כאן את הנתונים מהטלפון של הילד/ה ואת תוצאות המבחנים. אחרי
            ההתחברות יופיעו כאן כל ילדי המשפחה.
          </span>
          <button
            className="btn primary"
            onClick={() => {
              setSel('settings');
              setToFamily(true);
            }}
          >
            להתחברות
          </button>
        </div>
      )}

      {sel !== 'settings' && selKid && (
        <WithPacks ids={PACKS.map((p) => p.id)}>
          {(packs) => <ChildTab key={selKid.id} pid={selKid.id} grade={selKid.grade} name={selKid.name} allPacks={packs} />}
        </WithPacks>
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
            <p className="muted">4 עד 6 ספרות.</p>
            <div className="row">
              <input className="pin-input" dir="ltr" inputMode="numeric" type="password" maxLength={PIN_MAX} value={newPin} onChange={(e) => setNewPin(digits(e.target.value))} placeholder="קוד חדש" />
              <input className="pin-input" dir="ltr" inputMode="numeric" type="password" maxLength={PIN_MAX} value={newPin2} onChange={(e) => setNewPin2(digits(e.target.value))} placeholder="שוב" />
              <button
                className="btn ghost"
                disabled={!pinOk(newPin)}
                onClick={() => {
                  if (newPin !== newPin2) return setMsg('הקודים לא תואמים');
                  actions.setPin(newPin);
                  setNewPin('');
                  setNewPin2('');
                  setMsg('הקוד עודכן ✓');
                }}
              >
                עדכון
              </button>
            </div>
          </div>

          <FamilySync />

          <div className="card">
            <h3>גיבוי</h3>
            <p className="muted">ההתקדמות נשמרת רק במכשיר הזה. כדאי לשמור גיבוי מדי פעם.</p>
            {iosNotInstalled() && (
              <p className="note">
                באייפון ובאייפד, Safari עלול למחוק את ההתקדמות אם האפליקציה לא נפתחה כשבוע. כדי למנוע זאת, הוסיפו אותה למסך הבית: כפתור השיתוף ← „הוספה למסך הבית”. האפליקציה שעל מסך הבית שומרת את הנתונים בנפרד: שמרו גיבוי כאן קודם, ושחזרו אותו שם.
              </p>
            )}
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
                    if (f.size > MAX_BACKUP_BYTES) throw new Error('too large');
                    const { data: restored, merge } = readBackup(await f.text());
                    const ask = merge
                      ? 'הנתונים מהגיבוי יתווספו לנתונים שבמכשיר. ילדים שבגיבוי יחזרו, וגם ההתקדמות שלהם. להמשיך?'
                      : 'זה גיבוי בפורמט ישן: השחזור יחליף את כל הנתונים הנוכחיים. להמשיך?';
                    if (!confirm(ask)) return;
                    actions.restoreBackup(restored, merge);
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
