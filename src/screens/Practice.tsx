import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput, describeCorrect, describeUser, emptyUserAnswer } from '../components/AnswerInput';
import { Expression, MathText } from '../components/MathText';
import { Visual } from '../components/Visual';
import { checkAnswer, isComplete, type UserAnswer } from '../engine/check';
import { pick } from '../engine/math';
import { play } from '../engine/sound';
import { actions, getData, mastery, topicProgress } from '../engine/store';
import type { Level, Question } from '../engine/types';
import { topicById } from '../curricula';
import { Stars } from './Home';

export const SESSION_LEN = 10;

type Phase = 'answering' | 'retry' | 'correct' | 'revealed';

interface Current {
  topicId: string;
  level: Level;
  q: Question;
}

const PRAISE = ['מעולה! 🎉', 'כל הכבוד! 👏', 'נכון מאוד! ✨', 'יופי! 💪', 'אליפות! 🏆', 'מדויק! 🎯', 'וואו! 🤩'];
const RETRY = ['כמעט! נסו שוב 🙂', 'לא בדיוק... עוד ניסיון אחד 💪', 'חשבו שוב – אתם יכולים!'];

const masterySnapshot = (pid: string, topicIds: string[]) =>
  Object.fromEntries(topicIds.map((id) => [id, mastery(topicProgress(getData(), pid, id))])) as Record<string, number>;

function nextQuestion(pid: string, topicIds: string[], prevKey?: string): Current {
  for (let tries = 0; tries < 6; tries++) {
    const topicId = pick(topicIds);
    const level = topicProgress(getData(), pid, topicId).level;
    const q = topicById(topicId)!.generate(level);
    const key = q.prompt + (q.expression ?? '');
    if (key !== prevKey) return { topicId, level, q };
  }
  const topicId = pick(topicIds);
  const level = topicProgress(getData(), pid, topicId).level;
  return { topicId, level, q: topicById(topicId)!.generate(level) };
}

export function Practice({ pid, topicIds, title, onExit }: { pid: string; topicIds: string[]; title: string; onExit: () => void }) {
  const [startMastery, setStartMastery] = useState(() => masterySnapshot(pid, topicIds));
  const [cur, setCur] = useState<Current>(() => nextQuestion(pid, topicIds));
  const [user, setUser] = useState<UserAnswer>(() => emptyUserAnswer(cur.q.answer));
  const [phase, setPhase] = useState<Phase>('answering');
  const [hintUsed, setHintUsed] = useState(false);
  const [note, setNote] = useState<string>();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<('first' | 'second' | 'wrong')[]>([]);
  const [earned, setEarned] = useState(0);
  const [lastStars, setLastStars] = useState(0);
  const [toast, setToast] = useState<string>();
  const [showSolution, setShowSolution] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const nextRef = useRef<HTMLButtonElement>(null);
  const answered = phase === 'correct' || phase === 'revealed';

  // Focus "next" only after a pause, so the Enter key that submitted the answer doesn't also skip the feedback.
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 500);
    return () => clearTimeout(t);
  }, [answered]);

  const record = (result: 'first' | 'second' | 'wrong', u: UserAnswer) => {
    const r = actions.recordAnswer(
      pid,
      cur.topicId,
      cur.level,
      result,
      result === 'wrong' ? { prompt: cur.q.prompt, expression: cur.q.expression, given: describeUser(u, cur.q.answer), correct: describeCorrect(cur.q.answer) } : undefined,
    );
    setResults((rs) => [...rs, result]);
    setEarned((e) => e + r.stars);
    setLastStars(r.stars);
    if (r.levelChange === 1) {
      setToast(`🚀 עלית לרמה ${cur.level + 1}!`);
      play('levelup');
    } else if (r.levelChange === -1) {
      setToast('נתרגל קצת ברמה קלה יותר 🙂');
    }
  };

  const submit = (u: UserAnswer = user) => {
    if (phase === 'correct' || phase === 'revealed') return;
    if (!isComplete(u)) return;
    const res = checkAnswer(cur.q.answer, u);
    setNote(res.note);
    if (res.correct) {
      setPhase('correct');
      setMessage(pick(PRAISE));
      play('correct');
      record(phase === 'answering' && !hintUsed ? 'first' : 'second', u);
    } else if (phase === 'answering') {
      setPhase('retry');
      setMessage(pick(RETRY));
      play('wrong');
    } else {
      setPhase('revealed');
      setMessage('לא נורא! ככה פותרים:');
      setShowSolution(true);
      play('wrong');
      record('wrong', u);
    }
  };

  const loadQuestion = (n: Current) => {
    setCur(n);
    setUser(emptyUserAnswer(n.q.answer));
    setPhase('answering');
    setHintUsed(false);
    setNote(undefined);
    setShowSolution(false);
  };

  const restart = () => {
    setStartMastery(masterySnapshot(pid, topicIds));
    setDone(false);
    setResults([]);
    setEarned(0);
    setIndex(0);
    setToast(undefined);
    loadQuestion(nextQuestion(pid, topicIds));
  };

  const next = () => {
    setToast(undefined);
    if (index + 1 >= SESSION_LEN) {
      actions.endSession(pid);
      setDone(true);
      play('finish');
      return;
    }
    loadQuestion(nextQuestion(pid, topicIds, cur.q.prompt + (cur.q.expression ?? '')));
    setIndex((i) => i + 1);
  };

  if (done) {
    const correct = results.filter((r) => r !== 'wrong').length;
    const firsts = results.filter((r) => r === 'first').length;
    const gained = topicIds.filter((id) => mastery(topicProgress(getData(), pid, id)) > startMastery[id]);
    return (
      <div className="screen summary">
        {correct >= 7 && <Confetti />}
        <div className="big-emoji">{correct >= 9 ? '🏆' : correct >= 7 ? '🎉' : correct >= 5 ? '👍' : '💪'}</div>
        <h1>{correct >= 9 ? 'מדהים!' : correct >= 7 ? 'כל הכבוד!' : correct >= 5 ? 'עבודה טובה!' : 'ממשיכים להתאמן!'}</h1>
        <div className="card summary-card">
          <div className="stat">
            <b>
              {correct}/{SESSION_LEN}
            </b>
            <span>תשובות נכונות</span>
          </div>
          <div className="stat">
            <b>{firsts}</b>
            <span>בניסיון ראשון</span>
          </div>
          <div className="stat">
            <b>+{earned} ⭐</b>
            <span>כוכבים</span>
          </div>
        </div>
        {gained.map((id) => (
          <div key={id} className="card gained">
            קיבלת כוכב חדש ב<b>{topicById(id)!.title}</b>! <Stars n={mastery(topicProgress(getData(), pid, id))} />
          </div>
        ))}
        <div className="dots">
          {results.map((r, i) => (
            <span key={i} className={`dot ${r}`} />
          ))}
        </div>
        <div className="row center">
          <button className="btn primary" onClick={restart}>
            עוד סבב 🔁
          </button>
          <button className="btn ghost" onClick={onExit}>
            חזרה לנושאים
          </button>
        </div>
      </div>
    );
  }

  const topic = topicById(cur.topicId)!;
  const a = cur.q.answer;
  const reveal = answered
    ? { correctIndex: a.kind === 'choice' ? a.correct : undefined, picked: user.kind === 'choice' ? user.index : undefined, correctSign: a.kind === 'compare' ? a.correct : undefined }
    : undefined;

  return (
    <div className="screen practice">
      <header className="subbar">
        <button className="back" onClick={onExit} aria-label="יציאה">
          ✕
        </button>
        <div className="pbar" aria-label={`שאלה ${index + 1} מתוך ${SESSION_LEN}`}>
          <div className="pfill" style={{ width: `${(index / SESSION_LEN) * 100}%` }} />
        </div>
        <span className="chip">⭐ {earned}</span>
      </header>
      <div className="qmeta">
        {topicIds.length > 1 ? `${topic.emoji} ${topic.title}` : title} · רמה {cur.level}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className={`card question ${phase}`} key={index}>
        <p className="prompt">
          <MathText text={cur.q.prompt} />
        </p>
        {cur.q.visual && <Visual v={cur.q.visual} />}
        {cur.q.expression && <Expression text={cur.q.expression} />}

        <AnswerInput answer={a} value={user} onChange={(u) => { setUser(u); setNote(undefined); }} onSubmit={submit} disabled={answered} reveal={reveal} />

        {note && <p className="note">{note}</p>}

        {(phase === 'retry' || (hintUsed && !answered)) && cur.q.hint && (
          <p className="hint">
            💡 <MathText text={cur.q.hint} />
          </p>
        )}

        {phase !== 'answering' && <p className={`feedback ${phase}`}>{message}{phase === 'correct' && lastStars > 0 && <span className="earned"> +{lastStars}⭐</span>}</p>}

        {phase === 'correct' && !showSolution && (
          <button className="link small" onClick={() => setShowSolution(true)}>
            איך פותרים?
          </button>
        )}
        {showSolution && (
          <div className="solution">
            {phase === 'revealed' && (
              <p>
                התשובה הנכונה: <MathText text={describeCorrect(a)} />
              </p>
            )}
            <ol>
              {cur.q.solution.map((s, i) => (
                <li key={i}>
                  <MathText text={s} />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="actions">
        {!answered && a.kind !== 'choice' && a.kind !== 'compare' && (
          <button className="btn primary wide" disabled={!isComplete(user)} onClick={() => submit()}>
            {phase === 'retry' ? 'בדיקה שוב' : 'בדיקה ✓'}
          </button>
        )}
        {!answered && phase === 'answering' && !hintUsed && cur.q.hint && (
          <button className="btn ghost" onClick={() => setHintUsed(true)}>
            💡 רמז
          </button>
        )}
        {answered && (
          <button className="btn primary wide" onClick={next} ref={nextRef}>
            {index + 1 >= SESSION_LEN ? 'לסיכום 🏁' : 'הבא ←'}
          </button>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.8, emoji: pick(['🎉', '⭐', '✨', '🎊', '💜', '🟡']), dur: 2 + Math.random() * 1.5, key: i })), []);
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b) => (
        <span key={b.key} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}>
          {b.emoji}
        </span>
      ))}
    </div>
  );
}
