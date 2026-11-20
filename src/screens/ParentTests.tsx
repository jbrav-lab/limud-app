import { useEffect, useState } from 'react';
import { describeCorrect, describeUser } from '../components/AnswerInput';
import { Expression, MathText } from '../components/MathText';
import { Visual } from '../components/Visual';
import { MAX_QUESTIONS, MIN_QUESTIONS, buildExam, verbalGrade, type Difficulty, type ExamQuestion } from '../engine/exam';
import { scoreFrozen, standIn } from '../engine/frozen';
import type { Level } from '../engine/types';
import { dirClass, packInfo, topicById } from '../curricula';
import type { Pack } from '../curricula/types';
import { childTests, createParentTest, deleteTest, familyOfChild, loadReview, releaseTest, type ParentTestRow, type Review } from '../sync/tests';

/**
 * In the parent area, per child: create a test, follow it, review the submitted answers and release
 * the results (owner, 2026-11-20). Shown only for a child in the signed-in parent's family.
 */

type Mode = { m: 'list' } | { m: 'create' } | { m: 'review'; row: ParentTestRow };

const fmt = (t: number) => new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

export function ParentTestsPanel({ childId, grade, name, packs, levelOf }: { childId: string; grade?: number; name: string; packs: Pack[]; levelOf: (topicId: string) => Level }) {
  const [family, setFamily] = useState<string | null | undefined>(undefined);
  const [rows, setRows] = useState<ParentTestRow[] | null>(null);
  const [mode, setMode] = useState<Mode>({ m: 'list' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    childTests(childId)
      .then(setRows)
      .catch(() => setMsg('לא הצלחנו לטעון את המבחנים. בדקו את החיבור.'));
  useEffect(() => {
    familyOfChild(childId)
      .then((f) => {
        setFamily(f);
        if (f) void load();
      })
      .catch(() => setFamily(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  if (!family) return null;
  const subjectPacks = packs.filter((p) => p.grade === grade);

  if (mode.m === 'create')
    return (
      <CreateTest
        name={name}
        packs={subjectPacks}
        levelOf={levelOf}
        onCancel={() => setMode({ m: 'list' })}
        onSend={async (packId, topicIds, exam) => {
          await createParentTest({ familyId: family, childId, grade: grade ?? 0, packId, topicIds, exam });
          setMsg(`המבחן נשלח ל${name} ✓ הוא יופיע אצלו/אצלה בפתיחה הבאה של האפליקציה.`);
          setMode({ m: 'list' });
          await load();
        }}
      />
    );
  if (mode.m === 'review')
    return (
      <ReviewTest
        row={mode.row}
        name={name}
        onDone={async (released) => {
          if (released) setMsg(`התוצאות שוחררו ל${name} ✓`);
          setMode({ m: 'list' });
          await load();
        }}
      />
    );

  const waiting = rows?.filter((r) => r.submittedAt && !r.releasedAt).length ?? 0;
  return (
    <details className="card fold" open={waiting > 0 || undefined}>
      <summary>
        <h3>📝 מבחנים מההורים</h3>
        <span className="fold-count">{waiting ? `${waiting} מחכים לבדיקה` : rows?.length ? `${rows.length}` : ''}</span>
      </summary>
      <button className="btn primary" onClick={() => setMode({ m: 'create' })}>
        ➕ מבחן חדש ל{name}
      </button>
      {msg && <p className="note">{msg}</p>}
      {rows === null && <p className="muted">טוען…</p>}
      {rows?.length === 0 && <p className="muted">עוד לא נשלחו מבחנים.</p>}
      {!!rows?.length && (
        <table className="report">
          <thead>
            <tr>
              <th>נשלח</th>
              <th>מקצוע</th>
              <th>שאלות</th>
              <th>מצב</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmt(r.createdAt)}</td>
                <td>
                  {packInfo(r.packId)?.emoji} {packInfo(r.packId)?.title}
                </td>
                <td>{r.questions}</td>
                <td>{r.releasedAt ? <b>ציון {r.score}</b> : r.submittedAt ? <b>הוגש – לבדיקה</b> : <span className="muted">עוד לא הוגש</span>}</td>
                <td>
                  {r.submittedAt && !r.releasedAt && (
                    <button className="btn primary" onClick={() => setMode({ m: 'review', row: r })}>
                      בדיקה
                    </button>
                  )}
                  {r.releasedAt && (
                    <button className="btn ghost" onClick={() => setMode({ m: 'review', row: r })}>
                      צפייה
                    </button>
                  )}
                  {!r.submittedAt && (
                    <button
                      className="btn ghost"
                      onClick={() =>
                        confirm('למחוק את המבחן? הוא ייעלם גם מהטלפון של הילד/ה.') &&
                        deleteTest(r.testId)
                          .then(load)
                          .catch(() => setMsg('המחיקה נכשלה. בדקו את החיבור.'))
                      }
                    >
                      מחיקה
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}

type Mix = 'balanced' | Difficulty;
const MIXES: { id: Mix; label: string; hint: string }[] = [
  { id: 'balanced', label: 'מאוזן', hint: 'קל, בינוני וקשה' },
  { id: 'easy', label: 'קל', hint: 'רמה 1' },
  { id: 'medium', label: 'בינוני', hint: 'רמה 2' },
  { id: 'hard', label: 'קשה', hint: 'רמה 3' },
  { id: 'adaptive', label: 'לפי הרמה שלו/שלה', hint: 'כל נושא ברמה שהגיע/ה אליה' },
];

/** Balanced: about 30% level 1, 40% level 2, 30% level 3 (family-view-design.md, "Content"). */
const balancedLevel = (): Level => {
  const r = Math.random();
  return r < 0.3 ? 1 : r < 0.7 ? 2 : 3;
};

function CreateTest({
  name,
  packs,
  levelOf,
  onCancel,
  onSend,
}: {
  name: string;
  packs: Pack[];
  levelOf: (topicId: string) => Level;
  onCancel: () => void;
  onSend: (packId: string, topicIds: string[], exam: ExamQuestion[]) => Promise<void>;
}) {
  const [packId, setPackId] = useState(packs[0]?.id ?? '');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mix, setMix] = useState<Mix>('balanced');
  const [count, setCount] = useState(15);
  const [exam, setExam] = useState<ExamQuestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pack = packs.find((p) => p.id === packId);
  if (!pack) return <p className="muted">אין מקצועות לכיתה הזאת.</p>;

  const toggle = (ids: string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  const topics = pack.topics.filter((t) => picked.has(t.id));
  const build = () => setExam(buildExam(topics, mix === 'balanced' ? 'adaptive' : mix, count, mix === 'balanced' ? balancedLevel : levelOf));

  if (exam) {
    const send = () => {
      setBusy(true);
      setErr(null);
      onSend(pack.id, topics.map((t) => t.id), exam).catch((e: Error) => {
        setErr(e.message);
        setBusy(false);
      });
    };
    const sendButton = (
      <button className="btn primary" disabled={busy} onClick={send}>
        {busy ? 'שולח…' : `שליחה ל${name} ✓`}
      </button>
    );
    return (
      <div className="card">
        <h3>
          תצוגה מקדימה: {pack.emoji} {pack.title} · {exam.length} שאלות
        </h3>
        <div className="not-sent">
          <p>
            <b>המבחן עוד לא נשלח.</b> בדקו את השאלות ולחצו על "שליחה ל{name}".
          </p>
          {sendButton}
        </div>
        <p className="muted small-text">כך {name} יראה/תראה את השאלות. התשובות הנכונות מוצגות רק לכם.</p>
        <ol className="review preview-list">
          {exam.map((e, i) => (
            <li key={i} className={dirClass(e.topicId)}>
              <div className="mmeta">
                {topicById(e.topicId)?.emoji} {topicById(e.topicId)?.title} · רמה {e.level} · {e.points} נק׳
              </div>
              <MathText text={e.q.prompt} />
              {e.q.expression && <Expression text={e.q.expression} />}
              <div className="mans">
                תשובה: <span className="good"><MathText text={describeCorrect(e.q.answer)} /></span>
              </div>
            </li>
          ))}
        </ol>
        <div className="row sticky-actions">
          {err && <p className="note">{err}</p>}
          {sendButton}
          <button className="btn ghost" disabled={busy} onClick={build}>
            🔀 שאלות אחרות
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => setExam(null)}>
            חזרה להגדרות
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card parent-create">
      <div className="row spread">
        <h3>📝 מבחן חדש ל{name}</h3>
        <button className="btn ghost" onClick={onCancel}>
          ביטול
        </button>
      </div>

      <h4>1. מקצוע</h4>
      <div className="seg">
        {packs.map((p) => (
          <button
            key={p.id}
            className={`seg-btn ${p.id === packId ? 'on' : ''}`}
            aria-pressed={p.id === packId}
            onClick={() => {
              setPackId(p.id);
              setPicked(new Set());
            }}
          >
            <b>
              {p.emoji} {p.title}
            </b>
          </button>
        ))}
      </div>

      <div className="row spread">
        <h4>2. נושאים</h4>
        <button className="link small" onClick={() => toggle(pack.topics.map((t) => t.id), picked.size !== pack.topics.length)}>
          {picked.size === pack.topics.length ? 'ניקוי הכול' : 'כל הנושאים'}
        </button>
      </div>
      {pack.units.map((u) => {
        const ts = pack.topics.filter((t) => t.unit === u.id);
        const ids = ts.map((t) => t.id);
        return (
          <fieldset key={u.id} className="exam-unit" style={{ '--unit': u.color } as React.CSSProperties}>
            <legend>
              <label className="check unit-check">
                <input type="checkbox" checked={ids.every((id) => picked.has(id))} onChange={(e) => toggle(ids, e.target.checked)} />
                {u.title}
              </label>
            </legend>
            <div className="topic-checks">
              {ts.map((t) => (
                <label key={t.id} className={`check topic-check ${picked.has(t.id) ? 'on' : ''}`}>
                  <input type="checkbox" checked={picked.has(t.id)} onChange={(e) => toggle([t.id], e.target.checked)} />
                  <span>
                    {t.emoji} {t.title}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}

      <h4>3. רמת קושי</h4>
      <div className="seg">
        {MIXES.map((d) => (
          <button key={d.id} className={`seg-btn ${mix === d.id ? 'on' : ''}`} onClick={() => setMix(d.id)} aria-pressed={mix === d.id}>
            <b>{d.label}</b>
            <small>{d.hint}</small>
          </button>
        ))}
      </div>

      <h4>
        4. כמה שאלות? <span className="count-badge">{count}</span>
      </h4>
      <input className="range" type="range" min={MIN_QUESTIONS} max={MAX_QUESTIONS} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="מספר שאלות" />

      <button className="btn primary wide" disabled={!topics.length} onClick={build}>
        {topics.length ? `תצוגה מקדימה (${count} שאלות) ▶` : 'בחרו לפחות נושא אחד'}
      </button>
    </div>
  );
}

function ReviewTest({ row, name, onDone }: { row: ParentTestRow; name: string; onDone: (released: boolean) => Promise<void> }) {
  const [review, setReview] = useState<Review | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    loadReview(row)
      .then(setReview)
      .catch(() => setErr('לא הצלחנו לטעון את המבחן. בדקו את החיבור.'));
  }, [row]);

  if (err)
    return (
      <div className="card">
        <p className="note">{err}</p>
        <button className="btn ghost" onClick={() => void onDone(false)}>
          חזרה
        </button>
      </div>
    );
  if (!review) return <div className="card muted">טוען את המבחן…</div>;

  const { score, correct, marks } = scoreFrozen(review.questions, review.keys, review.answers);
  const released = Boolean(row.releasedAt);
  const shown = released ? (row.score ?? score) : score;
  return (
    <div className="card">
      <div className="row spread">
        <h3>
          📝 המבחן של {name} · {packInfo(row.packId)?.emoji} {packInfo(row.packId)?.title}
        </h3>
        <button className="btn ghost" onClick={() => void onDone(false)}>
          חזרה
        </button>
      </div>
      <p>
        <b className="big-score">{shown}</b> מתוך 100 · {verbalGrade(shown).label} · {correct} מתוך {review.questions.length} נכונות
      </p>
      <ol className="review">
        {review.questions.map((q, i) => {
          const m = marks[i];
          const key = review.keys[i];
          const a = review.answers[i];
          return (
            <li key={i} className={`${m.correct ? 'right' : 'wrong'} ${dirClass(q.topicId)}`}>
              <div className="mmeta">
                <span className="mark">{m.correct ? '✓' : '✗'}</span> {topicById(q.topicId)?.title} · רמה {q.level} · {m.correct ? q.points : 0}/{q.points} נק׳
              </div>
              <MathText text={q.prompt} />
              {q.visual && <Visual v={q.visual} />}
              {q.expression && <Expression text={q.expression} />}
              <div className="mans">
                ענה/תה: {m.answered && a ? <span className={m.correct ? 'good' : 'bad'}><MathText text={describeUser(a, standIn(q.input))} /></span> : <span className="muted">לא נענתה</span>}
                {m.note && <span className="note"> ({m.note})</span>}
                {!m.correct && key && (
                  <>
                    {' '}
                    · נכון: <span className="good"><MathText text={describeCorrect(key.answer)} /></span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {released ? (
        <p className="muted">התוצאות שוחררו{row.note ? ` עם ההערה: "${row.note}"` : ''}.</p>
      ) : (
        <>
          <label className="field">
            הערה ל{name} (לא חובה)
            <textarea value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value.replace(/[\u0000-\u001f\u007f]/g, ' '))} />
          </label>
          {err && <p className="note">{err}</p>}
          <button
            className="btn primary wide"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              releaseTest(row.id, score, note)
                .then(() => onDone(true))
                .catch(() => {
                  setErr('השחרור נכשל. בדקו את החיבור ונסו שוב.');
                  setBusy(false);
                });
            }}
          >
            {busy ? 'משחרר…' : `שחרור התוצאות ל${name} (ציון ${score}) ✓`}
          </button>
        </>
      )}
    </div>
  );
}
