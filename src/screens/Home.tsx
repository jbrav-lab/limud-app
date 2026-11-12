import { childProgress, mastery, topicProgress, useData, type AppData } from '../engine/store';
import { TOPICS, UNITS } from '../topics';

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

export function badges(data: AppData, pid: string): Badge[] {
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
    { icon: '🏅', title: 'אלוף בנושא', earned: TOPICS.some((t) => m(t.id) === 3) },
    { icon: '📝', title: 'מבחן ראשון', earned: (c.exams?.length ?? 0) >= 1 },
    { icon: '💯', title: 'ציון 100', earned: (c.exams ?? []).some((e) => e.score === 100) },
  ];
  for (const u of UNITS) {
    const ts = TOPICS.filter((t) => t.unit === u.id);
    list.push({ icon: '🏆', title: `${u.title}`, earned: ts.every((t) => m(t.id) >= 2) });
  }
  return list;
}

export function Home({
  pid,
  onTopic,
  onMixed,
  onSwitch,
  onParent,
  onExam,
}: {
  pid: string;
  onTopic: (id: string) => void;
  onMixed: (unitId?: string) => void;
  onSwitch: () => void;
  onParent: () => void;
  onExam: () => void;
}) {
  const data = useData();
  const profile = data.profiles.find((p) => p.id === pid);
  if (!profile) return null;
  const c = childProgress(data, pid);
  const bs = badges(data, pid);
  const practiced = TOPICS.filter((t) => topicProgress(data, pid, t.id).attempts > 0).length;
  const lastExam = c.exams?.[0];

  return (
    <div className="screen home">
      <header className="topbar">
        <button className="me" onClick={onSwitch} aria-label="החלפת ילד/ה">
          <span className="avatar sm">{profile.avatar}</span>
          <span>{profile.name}</span>
        </button>
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

      {UNITS.map((u) => {
        const ts = TOPICS.filter((t) => t.unit === u.id);
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
            <div className="topic-grid">
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
