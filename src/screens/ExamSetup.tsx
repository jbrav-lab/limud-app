import { useState } from 'react';
import { DIFFICULTIES, MAX_QUESTIONS, MIN_QUESTIONS, type Difficulty } from '../engine/exam';
import { TOPICS, UNITS } from '../topics';

export interface ExamConfig {
  topicIds: string[];
  difficulty: Difficulty;
  count: number;
}

export function ExamSetup({ onStart, onBack }: { onStart: (c: ExamConfig) => void; onBack: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count, setCount] = useState(DIFFICULTIES.find((d) => d.id === 'medium')!.defaultCount);

  const toggle = (ids: string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  const chooseDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    setCount(DIFFICULTIES.find((x) => x.id === d)!.defaultCount);
  };

  const allIds = TOPICS.map((t) => t.id);
  const allOn = picked.size === allIds.length;

  return (
    <div className="screen exam-setup">
      <header className="subbar">
        <button className="back" onClick={onBack} aria-label="חזרה">
          →
        </button>
        <div>
          <div className="crumb">מבחן לדוגמה, ציון מ-100</div>
          <h1>📝 הכנה למבחן</h1>
        </div>
      </header>

      <div className="card">
        <div className="row spread">
          <h3>1. על מה המבחן?</h3>
          <button className="link small" onClick={() => toggle(allIds, !allOn)}>
            {allOn ? 'ניקוי הכול' : 'כל הנושאים'}
          </button>
        </div>
        {UNITS.map((u) => {
          const ts = TOPICS.filter((t) => t.unit === u.id);
          const ids = ts.map((t) => t.id);
          const unitOn = ids.every((id) => picked.has(id));
          return (
            <fieldset key={u.id} className="exam-unit" style={{ '--unit': u.color } as React.CSSProperties}>
              <legend>
                <label className="check unit-check">
                  <input type="checkbox" checked={unitOn} onChange={(e) => toggle(ids, e.target.checked)} />
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
      </div>

      <div className="card">
        <h3>2. רמת קושי</h3>
        <div className="seg">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} className={`seg-btn ${difficulty === d.id ? 'on' : ''}`} onClick={() => chooseDifficulty(d.id)} aria-pressed={difficulty === d.id}>
              <b>{d.label}</b>
              <small>{d.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>
          3. כמה שאלות? <span className="count-badge">{count}</span>
        </h3>
        <input className="range" type="range" min={MIN_QUESTIONS} max={MAX_QUESTIONS} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="מספר שאלות" />
        <div className="row spread muted small-text">
          <span>{MIN_QUESTIONS}</span>
          <span>{MAX_QUESTIONS}</span>
        </div>
        <p className="muted small-text">כל שאלה שווה בערך {Math.round(100 / count)} נקודות{difficulty === 'adaptive' ? ' (שאלות ברמה גבוהה יותר שוות יותר)' : ''}.</p>
      </div>

      <button className="btn primary wide" disabled={picked.size === 0} onClick={() => onStart({ topicIds: allIds.filter((id) => picked.has(id)), difficulty, count })}>
        {picked.size === 0 ? 'בחרו לפחות נושא אחד' : `מתחילים מבחן (${count} שאלות) ▶`}
      </button>
    </div>
  );
}
