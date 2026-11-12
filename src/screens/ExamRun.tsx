import { useMemo, useState } from 'react';
import { AnswerInput, describeCorrect, describeUser, emptyUserAnswer } from '../components/AnswerInput';
import { Expression, MathText } from '../components/MathText';
import { Visual } from '../components/Visual';
import { checkAnswer, isComplete, type UserAnswer } from '../engine/check';
import { DIFFICULTIES, buildExam, verbalGrade, type ExamQuestion } from '../engine/exam';
import { play } from '../engine/sound';
import { actions, getData, topicProgress } from '../engine/store';
import { topicById } from '../curricula';
import type { ExamConfig } from './ExamSetup';

interface Graded {
  correct: boolean;
  note?: string;
  answered: boolean;
}

export function ExamRun({ pid, config, onExit, onNew }: { pid: string; config: ExamConfig; onExit: () => void; onNew: () => void }) {
  const [exam] = useState<ExamQuestion[]>(() =>
    buildExam(
      config.topicIds.map((id) => topicById(id)!).filter(Boolean),
      config.difficulty,
      config.count,
      (id) => topicProgress(getData(), pid, id).level,
    ),
  );
  const [answers, setAnswers] = useState<UserAnswer[]>(() => exam.map((e) => emptyUserAnswer(e.q.answer)));
  const [touched, setTouched] = useState<boolean[]>(() => exam.map(() => false));
  const [index, setIndex] = useState(0);
  const [graded, setGraded] = useState<Graded[] | null>(null);
  const [stars, setStars] = useState(0);
  const [confirming, setConfirming] = useState(false);

  const answeredAt = (i: number) => touched[i] && isComplete(answers[i]);
  const unanswered = exam.filter((_, i) => !answeredAt(i)).length;

  const setAnswer = (i: number, u: UserAnswer) => {
    setAnswers((a) => a.map((x, j) => (j === i ? u : x)));
    setTouched((t) => t.map((x, j) => (j === i ? true : x)));
  };

  const submit = () => {
    const g: Graded[] = exam.map((e, i) => {
      if (!answeredAt(i)) return { correct: false, answered: false };
      const r = checkAnswer(e.q.answer, answers[i]);
      return { correct: r.correct, note: r.note, answered: true };
    });
    const score = exam.reduce((s, e, i) => s + (g[i].correct ? e.points : 0), 0);
    const earned = actions.recordExam(
      pid,
      { packId: config.packId, topicIds: config.topicIds, difficulty: config.difficulty, questions: exam.length, correct: g.filter((x) => x.correct).length, score },
      exam.map((e, i) => ({
        topicId: e.topicId,
        level: e.level,
        correct: g[i].correct,
        mistake: g[i].correct
          ? undefined
          : { prompt: e.q.prompt, expression: e.q.expression, given: g[i].answered ? describeUser(answers[i], e.q.answer) : '—', correct: describeCorrect(e.q.answer) },
      })),
    );
    setStars(earned);
    setGraded(g);
    play(score >= 85 ? 'finish' : 'correct');
    scrollTo(0, 0);
  };

  if (graded) return <ExamResults exam={exam} answers={answers} graded={graded} stars={stars} config={config} onExit={onExit} onNew={onNew} />;

  const e = exam[index];
  const topic = topicById(e.topicId)!;
  const last = index === exam.length - 1;

  return (
    <div className="screen exam-run">
      <header className="subbar">
        <button className="back" onClick={() => (confirm('לצאת מהמבחן? התשובות לא יישמרו.') ? onExit() : undefined)} aria-label="יציאה">
          ✕
        </button>
        <div className="exam-title">
          <b>📝 מבחן</b>
          <span className="muted">
            שאלה {index + 1} מתוך {exam.length}
          </span>
        </div>
        <span className="chip">{exam.length - unanswered}/{exam.length} ✎</span>
      </header>

      <nav className="qnav" aria-label="מעבר בין שאלות">
        {exam.map((_, i) => (
          <button key={i} className={`qdot ${i === index ? 'current' : ''} ${answeredAt(i) ? 'done' : ''}`} onClick={() => setIndex(i)} aria-label={`שאלה ${i + 1}${answeredAt(i) ? ', נענתה' : ''}`}>
            {i + 1}
          </button>
        ))}
      </nav>

      <div className="card question" key={index}>
        <div className="qhead">
          <span className="muted">
            {topic.emoji} {topic.title}
          </span>
          <span className="points">{e.points} נק׳</span>
        </div>
        <p className="prompt">
          <MathText text={e.q.prompt} />
        </p>
        {e.q.visual && <Visual v={e.q.visual} />}
        {e.q.expression && <Expression text={e.q.expression} />}
        <AnswerInput
          answer={e.q.answer}
          value={answers[index]}
          onChange={(u) => setAnswer(index, u)}
          onSubmit={(u) => {
            if (u) setAnswer(index, u);
            else if (!last) setIndex(index + 1);
          }}
          disabled={false}
          showSelection={touched[index]}
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
          <button className="btn primary" onClick={() => (unanswered ? setConfirming(true) : submit())}>
            הגשת המבחן ✓
          </button>
        )}
      </div>
      {!last && (
        <button className="link small center-block" onClick={() => (unanswered ? setConfirming(true) : submit())}>
          הגשת המבחן עכשיו
        </button>
      )}

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
                setIndex(exam.findIndex((_, i) => !answeredAt(i)));
              }}
            >
              חזרה לשאלות
            </button>
            <button className="btn primary" onClick={submit}>
              להגיש בכל זאת
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamResults({
  exam,
  answers,
  graded,
  stars,
  config,
  onExit,
  onNew,
}: {
  exam: ExamQuestion[];
  answers: UserAnswer[];
  graded: Graded[];
  stars: number;
  config: ExamConfig;
  onExit: () => void;
  onNew: () => void;
}) {
  const score = exam.reduce((s, e, i) => s + (graded[i].correct ? e.points : 0), 0);
  const grade = verbalGrade(score);
  const [open, setOpen] = useState<number | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const byTopic = useMemo(
    () =>
      config.topicIds
        .map((id) => {
          const idx = exam.map((e, i) => (e.topicId === id ? i : -1)).filter((i) => i >= 0);
          return { id, total: idx.length, right: idx.filter((i) => graded[i].correct).length };
        })
        .filter((x) => x.total > 0),
    [config.topicIds, exam, graded],
  );
  const diff = DIFFICULTIES.find((d) => d.id === config.difficulty)!;

  return (
    <div className="screen exam-results">
      <div className="score-hero">
        <div className="big-emoji">{grade.emoji}</div>
        <div className="score-ring" style={{ '--pct': `${score}%` } as React.CSSProperties}>
          <span className="score-num">{score}</span>
          <span className="score-of">מתוך 100</span>
        </div>
        <h1>{grade.label}</h1>
        <p className="muted">{grade.cheer}</p>
        <p className="small-text muted">
          {graded.filter((g) => g.correct).length} מתוך {exam.length} תשובות נכונות · רמה: {diff.label} · +{stars} ⭐
        </p>
      </div>

      <div className="card">
        <h3>לפי נושא</h3>
        {byTopic.map((t) => {
          const topic = topicById(t.id)!;
          const pct = Math.round((t.right / t.total) * 100);
          return (
            <div key={t.id} className="topic-bar">
              <span className="tb-name">
                {topic.emoji} {topic.title}
              </span>
              <span className="tb-track">
                <span className={`tb-fill ${pct < 60 ? 'weak' : ''}`} style={{ width: `${pct}%` }} />
              </span>
              <span className="tb-val">
                {t.right}/{t.total}
              </span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="row spread">
          <h3>בדיקת המבחן</h3>
          <label className="check small-text">
            <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} /> רק טעויות
          </label>
        </div>
        <ol className="review">
          {exam.map((e, i) => {
            const g = graded[i];
            if (onlyWrong && g.correct) return null;
            return (
              <li key={i} className={g.correct ? 'right' : 'wrong'}>
                <button className="review-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <span className="mark">{g.correct ? '✓' : '✗'}</span>
                  <span className="rq">
                    <MathText text={e.q.prompt} />
                  </span>
                  <span className="rpts">
                    {g.correct ? e.points : 0}/{e.points}
                  </span>
                </button>
                {open === i && (
                  <div className="review-body">
                    {e.q.visual && <Visual v={e.q.visual} />}
                    {e.q.expression && <Expression text={e.q.expression} />}
                    <p>
                      התשובה שלך: {g.answered ? <MathText text={describeUser(answers[i], e.q.answer)} /> : <span className="muted">לא נענתה</span>}
                      {g.note && <span className="note"> ({g.note})</span>}
                    </p>
                    {!g.correct && (
                      <p>
                        התשובה הנכונה: <MathText text={describeCorrect(e.q.answer)} />
                      </p>
                    )}
                    <div className="solution">
                      <ol>
                        {e.q.solution.map((s, k) => (
                          <li key={k}>
                            <MathText text={s} />
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="row center">
        <button className="btn primary" onClick={onNew}>
          מבחן חדש 📝
        </button>
        <button className="btn ghost" onClick={onExit}>
          חזרה לנושאים
        </button>
      </div>
    </div>
  );
}
