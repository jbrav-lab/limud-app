import type { ReactNode } from 'react';
import { gradeLabel, packsForGrade, usePacks } from '../curricula';
import type { Pack } from '../curricula/types';
import { mastery, topicProgress, useData } from '../engine/store';
import { TopBar } from './Home';

/** Renders children once the given curriculum packs are loaded. */
export function WithPacks({ ids, children }: { ids: string[]; children: (packs: Pack[]) => ReactNode }) {
  const packs = usePacks(ids);
  if (!packs) return <div className="screen loading">⏳</div>;
  return <>{children(packs)}</>;
}

/** "מה לומדים היום?": the subjects of the child's grade. */
export function Subjects({ pid, onPick, onSwitch, onParent }: { pid: string; onPick: (packId: string) => void; onSwitch: () => void; onParent: () => void }) {
  const data = useData();
  const profile = data.profiles.find((p) => p.id === pid);
  const infos = packsForGrade(profile?.grade ?? 0);
  const packs = usePacks(infos.map((p) => p.id));
  if (!profile) return null;

  return (
    <div className="screen subjects">
      <TopBar pid={pid} onSwitch={onSwitch} onParent={onParent} />
      <h1 className="center">מה לומדים היום?</h1>
      <p className="center muted">{gradeLabel(profile.grade)}</p>

      {infos.length === 0 && (
        <div className="card center">
          <p>עוד אין מקצועות ל{gradeLabel(profile.grade)}. בקרוב! 🙂</p>
          <p className="muted small-text">אפשר לשנות כיתה באזור ההורים ← הגדרות.</p>
        </div>
      )}

      <div className="subject-grid">
        {infos.map((info) => {
          const pack = packs?.find((p) => p.id === info.id);
          const earned = pack ? pack.topics.reduce((s, t) => s + mastery(topicProgress(data, pid, t.id)), 0) : 0;
          const max = pack ? pack.topics.length * 3 : 0;
          return (
            <button key={info.id} className="subject-card" onClick={() => onPick(info.id)}>
              <span className="s-emoji">{info.emoji}</span>
              <span className="s-title">{info.title}</span>
              {pack && (
                <span className="s-meta">
                  ★ {earned}/{max}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
