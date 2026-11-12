import { Expression, MathText } from '../components/MathText';
import { Visual } from '../components/Visual';
import { mastery, topicProgress, useData } from '../engine/store';
import { topicById, unitById } from '../topics';
import { Stars } from './Home';

export function Lesson({ pid, topicId, onPractice, onBack }: { pid: string; topicId: string; onPractice: () => void; onBack: () => void }) {
  const data = useData();
  const topic = topicById(topicId);
  if (!topic) return null;
  const unit = unitById(topic.unit);
  const tp = topicProgress(data, pid, topicId);

  return (
    <div className="screen lesson" style={{ '--unit': unit.color } as React.CSSProperties}>
      <header className="subbar">
        <button className="back" onClick={onBack} aria-label="חזרה">
          →
        </button>
        <div>
          <div className="crumb">{unit.title}</div>
          <h1>
            {topic.emoji} {topic.title}
          </h1>
        </div>
      </header>

      <div className="card progress-card">
        <Stars n={mastery(tp)} />
        <span>{tp.attempts ? `רמה ${tp.level} · ענית על ${tp.attempts} שאלות` : 'עוד לא תרגלת את הנושא הזה'}</span>
        <button className="btn primary" onClick={onPractice}>
          {tp.attempts ? 'ממשיכים לתרגל ▶' : 'מתחילים לתרגל ▶'}
        </button>
      </div>

      <h2>📘 בקצרה</h2>
      <div className="card lesson-body">
        {topic.lesson.map((b, i) => {
          switch (b.kind) {
            case 'text':
              return (
                <p key={i}>
                  <MathText text={b.text} />
                </p>
              );
            case 'tip':
              return (
                <p key={i} className="tip">
                  💡 <MathText text={b.text} />
                </p>
              );
            case 'example':
              return (
                <div key={i} className="example">
                  {b.text && <MathText text={b.text} />}
                  {b.expression && <Expression text={b.expression} />}
                </div>
              );
            case 'visual':
              return (
                <figure key={i}>
                  <Visual v={b.visual} />
                  {b.caption && (
                    <figcaption>
                      <MathText text={b.caption} />
                    </figcaption>
                  )}
                </figure>
              );
          }
        })}
      </div>
      <button className="btn primary wide" onClick={onPractice}>
        בואו נתרגל! ▶
      </button>
    </div>
  );
}
