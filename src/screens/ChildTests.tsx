import { useEffect, useState, useSyncExternalStore } from 'react';
import { AnswerInput, describeCorrect, describeUser, emptyUserAnswer } from '../components/AnswerInput';
import { Expression, MathText } from '../components/MathText';
import { Visual } from '../components/Visual';
import { isComplete } from '../engine/check';
import { scoreFrozen, standIn, type SubmittedAnswer } from '../engine/frozen';
import { verbalGrade } from '../engine/exam';
import { play } from '../engine/sound';
import { dirClass, packIdOf, topicById } from '../curricula';
import { WithPacks } from './Subjects';
import { cachedTests, devicePaired, markSeen, recordReleasedTests, onTestsChange, refreshDeviceTests, saveAnswers, savedAnswers, submitTest, type DeviceTest } from '../sync/tests';

/** This child's tests on this device (from the last refresh), kept current. */
function useChildTests(pid: string): DeviceTest[] {
  const snap = useSyncExternalStore(onTestsChange, () => localStorage.getItem('limud-parent-tests') + '|' + localStorage.getItem('limud-test-answers'));
  useEffect(() => {
    void refreshDeviceTests();
  }, []);
  void snap;
  return cachedTests().filter((t) => t.childId === pid);
}

/** On the child's screens: tests from a parent to take, waiting for review, or with results ready. */
export function ParentTestsBanner({ pid, onOpen }: { pid: string; onOpen: (assignmentId: string) => void }) {
  const tests = useChildTests(pid);
  if (!devicePaired()) return null;
  const rows = tests
    .map((t) => ({ t, s: savedAnswers(t.assignmentId) }))
    .filter(({ t, s }) => !(t.released && s?.seen));
  if (!rows.length) return null;
  return (
    <div className="card ptest-banner">
      {rows.map(({ t, s }) => {
        const done = t.submitted || s?.done;
        return (
          <div key={t.assignmentId} className="row spread">
            {t.released ? (
              <span>🎉 התוצאות של המבחן מההורים מוכנות!</span>
            ) : done ? (
              <span className="muted">✓ המבחן נשלח – מחכה לבדיקת מבוגר{!t.submitted && s?.done && !s.sent ? ' (יישלח כשיהיה אינטרנט)' : ''}</span>
            ) : (
              <span>
                📝 <b>יש לך מבחן מההורים!</b> {t.questions.length} שאלות
              </span>
            )}
            {(t.released || !done) && (
              <button className="btn primary" onClick={() => onOpen(t.assignmentId)}>
                {t.released ? 'לתוצאות' : s?.answers?.some(Boolean) ? 'להמשיך' : 'להתחיל'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The test screen: take it, see that it was sent, or (after release) the results. */
export function ParentTestScreen({ pid, assignmentId, onExit }: { pid: string; assignmentId: string; onExit: () => void }) {
  const tests = useChildTests(pid);
  const t = tests.find((x) => x.assignmentId === assignmentId);
  if (!t) {
    return (
      <div className="screen">
        <div className="card center">
          <p>המבחן הזה לא נמצא (אולי ההורים מחקו אותו).</p>
          <button className="btn primary" onClick={onExit}>
            חזרה
          </button>
        </div>
      </div>
    );
  }
  const packIds = [...new Set(t.questions.map((q) => packIdOf(q.topicId)))];
  return (
    <WithPacks ids={packIds}>
      {() => (t.released && t.keys ? <Results t={t} onExit={onExit} /> : t.submitted || savedAnswers(t.assignmentId)?.done ? <Sent t={t} onExit={onExit} /> : <Run t={t} onExit={onExit} />)}
    </WithPacks>
  );
}

function Sent({ t, onExit }: { t: DeviceTest; onExit: () => void }) {
  const s = savedAnswers(t.assignmentId);
  return (
    <div className="screen">
      <div className="card center">
        <div className="big-emoji">📨</div>
        <h2>נשלח ✓ – מחכה לבדיקת מבוגר</h2>
        {!t.submitted && s?.done && !s.sent && <p className="muted">התשובות שמורות בטלפון ויישלחו כשיהיה אינטרנט.</p>}
        <p className="muted">כשההורים יבדקו, התוצאות יופיעו כאן.</p>
        <button className="btn primary" onClick={onExit}>
          חזרה
        </button>
      </div>
    </div>
  );
}

function Run({ t, onExit }: { t: DeviceTest; onExit: () => void }) {
  const qs = t.questions;
  const [answers, setAnswers] = useState<SubmittedAnswer[]>(() => {
    const s = savedAnswers(t.assignmentId)?.answers ?? [];
    return qs.map((_, i) => s[i] ?? null);
  });
  const [index, setIndex] = useState(() => Math.max(0, answers.findIndex((a) => !a)));
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const answeredAt = (i: number) => Boolean(answers[i] && isComplete(answers[i]!));
  const unanswered = qs.filter((_, i) => !answeredAt(i)).length;
  const setAnswer = (i: number, u: SubmittedAnswer) => {
    const next = answers.map((x, j) => (j === i ? u : x));
    setAnswers(next);
    saveAnswers(t.assignmentId, next); // saved at once, so nothing is lost
  };
  const submit = () => {
    setSending(true);
    play('finish');
    void submitTest(t.assignmentId, answers).finally(() => setSending(false));
  };

  const q = qs[index];
  const a = standIn(q.input);
  const topic = topicById(q.topicId);
  const last = index === qs.length - 1;

  return (
    <div className="screen exam-run">
      <header className="subbar">
        <button className="back" onClick={onExit} aria-label="יציאה (התשובות נשמרות)">
          ✕
        </button>
        <div className="exam-title">
          <b>📝 מבחן מההורים</b>
          <span className="muted">
            שאלה {index + 1} מתוך {qs.length}
          </span>
        </div>
        <span className="chip">
          {qs.length - unanswered}/{qs.length} ✎
        </span>
      </header>

      <nav className="qnav" aria-label="מעבר בין שאלות">
        {qs.map((_, i) => (
          <button key={i} className={`qdot ${i === index ? 'current' : ''} ${answeredAt(i) ? 'done' : ''}`} onClick={() => setIndex(i)} aria-label={`שאלה ${i + 1}${answeredAt(i) ? ', נענתה' : ''}`}>
            {i + 1}
          </button>
        ))}
      </nav>

      <div className={`card question ${dirClass(q.topicId)}`} key={index}>
        <div className="qhead">
          <span className="muted">
            {topic?.emoji} {topic?.title}
          </span>
          <span className="points">{q.points} נק׳</span>
        </div>
        <p className="prompt">
          <MathText text={q.prompt} />
        </p>
        {q.visual && <Visual v={q.visual} />}
        {q.expression && <Expression text={q.expression} />}
        <AnswerInput
          answer={a}
          value={answers[index] ?? emptyUserAnswer(a)}
          onChange={(u) => setAnswer(index, u)}
          onSubmit={(u) => {
            if (u) setAnswer(index, u);
            else if (!last) setIndex(index + 1);
          }}
          disabled={sending}
          showSelection={Boolean(answers[index])}
        />
      </div>

      <div className="row exam-actions">
        <button className="btn ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          → הקודמת
        </button>
        {!last ? (
          <button className="btn primary" onClick={() => setIndex(index + 1)}>
            הבאה ←
          </button>
        ) : (
          <button className="btn primary" disabled={sending} onClick={() => (unanswered ? setConfirming(true) : submit())}>
            הגשת המבחן ✓
          </button>
        )}
      </div>
      <p className="center muted small-text">התשובות נשמרות בטלפון. אפשר לצאת ולהמשיך אחר כך.</p>

      {confirming && (
        <div className="card confirm">
          <p>
            {unanswered === 1 ? 'נשארה שאלה אחת בלי תשובה.' : `נשארו ${unanswered} שאלות בלי תשובה.`} שאלה בלי תשובה מקבלת 0 נקודות.
          </p>
          <div className="row">
            <button
              className="btn ghost"
              onClick={() => {
                setConfirming(false);
                setIndex(qs.findIndex((_, i) => !answeredAt(i)));
              }}
            >
              חזרה לשאלות
            </button>
            <button className="btn primary" disabled={sending} onClick={submit}>
              להגיש בכל זאת
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Results({ t, onExit }: { t: DeviceTest; onExit: () => void }) {
  const answers = savedAnswers(t.assignmentId)?.answers ?? [];
  const { marks, correct } = scoreFrozen(t.questions, t.keys!, answers);
  const score = t.score ?? 0;
  const grade = verbalGrade(score);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    recordReleasedTests();
    markSeen(t.assignmentId);
  }, [t.assignmentId]);
  return (
    <div className="screen exam-results">
      <div className="score-hero">
        <div className="big-emoji">{grade.emoji}</div>
        <div className="score-ring" style={{ '--pct': `${score}%` } as React.CSSProperties}>
          <span className="score-num">{score}</span>
          <span className="score-of">מתוך 100</span>
        </div>
        <h1>{grade.label}</h1>
        <p className="small-text muted">
          {correct} מתוך {t.questions.length} תשובות נכונות · מבחן מההורים
        </p>
      </div>
      {t.note && (
        <div className="card">
          <h3>💬 הערה מההורים</h3>
          <p>{t.note}</p>
        </div>
      )}
      <div className="card">
        <h3>בדיקת המבחן</h3>
        <ol className="review">
          {t.questions.map((q, i) => {
            const m = marks[i];
            const key = t.keys![i];
            return (
              <li key={i} className={`${m.correct ? 'right' : 'wrong'} ${dirClass(q.topicId)}`}>
                <button className="review-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <span className="mark">{m.correct ? '✓' : '✗'}</span>
                  <span className="rq">
                    <MathText text={q.prompt} />
                  </span>
                  <span className="rpts">
                    {m.correct ? q.points : 0}/{q.points}
                  </span>
                </button>
                {open === i && (
                  <div className="review-body">
                    {q.visual && <Visual v={q.visual} />}
                    {q.expression && <Expression text={q.expression} />}
                    <p>
                      התשובה שלך: {m.answered ? <MathText text={describeUser(answers[i]!, standIn(q.input))} /> : <span className="muted">לא נענתה</span>}
                      {m.note && <span className="note"> ({m.note})</span>}
                    </p>
                    {!m.correct && key && (
                      <p>
                        התשובה הנכונה: <MathText text={describeCorrect(key.answer)} />
                      </p>
                    )}
                    {key && (
                      <div className="solution">
                        <ol>
                          {key.solution.map((s, k) => (
                            <li key={k}>
                              <MathText text={s} />
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="row center">
        <button className="btn primary" onClick={onExit}>
          חזרה
        </button>
      </div>
    </div>
  );
}
