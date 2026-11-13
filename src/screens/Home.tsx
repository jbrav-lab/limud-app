import { useEffect, useState } from 'react';
import { actions, childProgress, mastery, topicProgress, useData, type AppData } from '../engine/store';
import { AvatarGrid } from './Profiles';
import type { Pack } from '../curricula/types';

export function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span className="stars" aria-label={`${n} מתוך ${of} כוכבים`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < n ? 'on' : 'off'}>
          ★
        </span>
      ))}
    </span>
  );
}

interface Badge {
  icon: string;
  title: string;
  earned: boolean;
}

/** Badges for the collection strip: general ones plus one per unit of the current subject. */
export function badges(data: AppData, pid: string, pack: Pack): Badge[] {
  const c = childProgress(data, pid);
  const m = (id: string) => mastery(topicProgress(data, pid, id));
  const answered = Object.values(c.daily).reduce((s, x) => s + x, 0);
  const list: Badge[] = [
    { icon: '👣', title: 'צעד ראשון', earned: c.sessions >= 1 },
    { icon: '✅', title: '100 תשובות', earned: answered >= 100 },
    { icon: '🔥', title: '3 ימים ברצף', earned: c.streakDays >= 3 },
    { icon: '🌋', title: '7 ימים ברצף', earned: c.streakDays >= 7 },
    { icon: '⭐', title: '100 כוכבים', earned: c.stars >= 100 },
    { icon: '🌠', title: '500 כוכבים', earned: c.stars >= 500 },
    { icon: '🏅', title: 'אלוף בנושא', earned: Object.values(c.topics).some((tp) => mastery(tp) === 3) },
    { icon: '📝', title: 'מבחן ראשון', earned: (c.exams?.length ?? 0) >= 1 },
    { icon: '💯', title: 'ציון 100', earned: (c.exams ?? []).some((e) => e.score === 100) },
  ];
  for (const u of pack.units) {
    const ts = pack.topics.filter((t) => t.unit === u.id);
    list.push({ icon: '🏆', title: `${u.title}`, earned: ts.every((t) => m(t.id) >= 2) });
  }
  return list;
}

/** A bottom sheet where the child picks a new avatar. Saved only on "שמירה". */
function AvatarSheet({ pid, current, onClose }: { pid: string; current: string; onClose: () => void }) {
  const [avatar, setAvatar] = useState(current);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="בחירת דמות" onClick={(e) => e.stopPropagation()}>
        <h2>בחרו דמות חדשה</h2>
        <div className="sheet-preview" aria-hidden>
          {avatar}
        </div>
        <AvatarGrid value={avatar} onPick={setAvatar} />
        <div className="row">
          <button
            className="btn primary"
            onClick={() => {
              actions.setAvatar(pid, avatar);
              onClose();
            }}
          >
            שמירה
          </button>
          <button className="btn ghost" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

/** The child's top bar: their avatar (tap to change it), name (tap to switch child), stars, streak and the parent lock. */
export function TopBar({ pid, onSwitch, onParent }: { pid: string; onSwitch: () => void; onParent: () => void }) {
  const data = useData();
  const [picking, setPicking] = useState(false);
  const profile = data.profiles.find((p) => p.id === pid);
  if (!profile) return null;
  const c = childProgress(data, pid);
  return (
    <header className="topbar">
      <div className="me">
        <button className="me-avatar" onClick={() => setPicking(true)} aria-label="החלפת הדמות שלי">
          <span className="avatar sm">{profile.avatar}</span>
          <span className="edit-dot" aria-hidden>
            ✏️
          </span>
        </button>
        <button className="me-name" onClick={onSwitch} aria-label="החלפת ילד/ה">
          {profile.name}
        </button>
      </div>
      {picking && <AvatarSheet pid={pid} current={profile.avatar} onClose={() => setPicking(false)} />}
      <div className="chips">
        <span className="chip" title="כוכבים">
          ⭐ {c.stars}
        </span>
        <span className="chip" title="ימים ברצף">
          🔥 {c.streakDays}
        </span>
        <button className="chip btnchip" onClick={onParent} aria-label="אזור הורים">
          🔒
        </button>
      </div>
    </header>
  );
}

/** A subject's home: its units and topics, test prep and mixed practice. */
export function Home({
  pid,
  pack,
  onTopic,
  onMixed,
  onSwitch,
  onParent,
  onExam,
  onSubjects,
}: {
  pid: string;
  pack: Pack;
  onTopic: (id: string) => void;
  onMixed: (unitId?: string) => void;
  onSwitch: () => void;
  onParent: () => void;
  onExam: () => void;
  /** Back to the subject list (only when the child's grade has more than one subject). */
  onSubjects?: () => void;
}) {
  const data = useData();
  const c = childProgress(data, pid);
  const bs = badges(data, pid, pack);
  const practiced = pack.topics.filter((t) => topicProgress(data, pid, t.id).attempts > 0).length;
  const lastExam = c.exams?.find((e) => e.packId === pack.id);

  return (
    <div className="screen home">
      <TopBar pid={pid} onSwitch={onSwitch} onParent={onParent} />

      <div className="subject-head">
        {onSubjects && (
          <button className="back" onClick={onSubjects} aria-label="כל המקצועות">
            →
          </button>
        )}
        <h1>
          {pack.emoji} {pack.title}
        </h1>
      </div>

      <section className="badges" aria-label="האוסף שלי">
        {bs.map((b) => (
          <span key={b.title} className={`badge ${b.earned ? 'earned' : ''}`} title={b.title}>
            <span className="bicon">{b.earned ? b.icon : '🔒'}</span>
            <span className="btitle">{b.title}</span>
          </span>
        ))}
      </section>

      <div className="home-actions">
        <button className="btn exam-btn" onClick={onExam}>
          <span className="ea-icon">📝</span>
          <span className="ea-text">
            <b>הכנה למבחן</b>
            <small>{lastExam ? `ציון אחרון: ${lastExam.score}` : 'מבחן לדוגמה עם ציון מ-100'}</small>
          </span>
        </button>
        {practiced >= 2 && (
          <button className="btn mixed-btn" onClick={() => onMixed()}>
            🎲 תרגול מעורב
          </button>
        )}
      </div>

      {pack.units.map((u) => {
        const ts = pack.topics.filter((t) => t.unit === u.id);
        return (
          <section key={u.id} className="unit" style={{ '--unit': u.color } as React.CSSProperties}>
            <div className="unit-head">
              <h2>{u.title}</h2>
              {ts.length > 1 && ts.some((t) => topicProgress(data, pid, t.id).attempts > 0) && (
                <button className="link small" onClick={() => onMixed(u.id)}>
                  🎲 תרגול מעורב
                </button>
              )}
            </div>
            <div className="topic-grid" dir={pack.dir}>
              {ts.map((t) => {
                const tp = topicProgress(data, pid, t.id);
                const m = mastery(tp);
                return (
                  <button key={t.id} className={`topic-card ${m === 3 ? 'mastered' : ''}`} onClick={() => onTopic(t.id)}>
                    <span className="temoji">{t.emoji}</span>
                    <span className="ttitle">{t.title}</span>
                    <span className="tmeta">
                      <Stars n={m} />
                      {tp.attempts > 0 && <span className="lvl">רמה {tp.level}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="footnote">כל נושא: 5 תשובות נכונות ברמה 1 ← ★, ברמה 2 ← ★★, ברמה 3 ← ★★★</p>
    </div>
  );
}
