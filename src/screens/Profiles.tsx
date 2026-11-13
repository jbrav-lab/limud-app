import { useEffect, useState } from 'react';
import { actions, childProgress, useData, type ProfileFields } from '../engine/store';
import { DEFAULT_GRADE, GRADES, gradeLabel, packsForGrade } from '../curricula';
import { THEMES, applyTheme, validTheme } from '../themes';

export const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐵', '🦄', '🐙', '🐯', '🐨', '🐧', '🐶', '🦉', '🦖', '🐬', '🚀', '⚽', '🎨', '🌟'];

/** The avatar choices as a grid of buttons; the chosen one is highlighted. */
export function AvatarGrid({ value, onPick }: { value: string; onPick: (a: string) => void }) {
  return (
    <div className="avatar-grid">
      {AVATARS.map((a) => (
        <button key={a} className={`avatar-btn ${a === value ? 'selected' : ''}`} onClick={() => onPick(a)} aria-label={a} aria-pressed={a === value}>
          {a}
        </button>
      ))}
    </div>
  );
}

export function ProfileForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: ProfileFields;
  onDone: (fields: ProfileFields) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATARS[0]);
  const [theme, setTheme] = useState(validTheme(initial?.theme));
  const [grade, setGrade] = useState(initial?.grade ?? DEFAULT_GRADE);

  // Preview the chosen colors live; put the page's theme back when the form closes.
  useEffect(() => {
    const before = document.documentElement.dataset.theme;
    return () => applyTheme(before);
  }, []);
  useEffect(() => applyTheme(theme), [theme]);

  return (
    <div className="card form">
      <label className="field">
        השם שלי
        <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="למשל: נועה" autoFocus />
      </label>
      <div className="field">
        באיזו כיתה?
        <div className="seg">
          {GRADES.map((g) => (
            <button key={g.grade} className={`seg-btn ${g.grade === grade ? 'on' : ''}`} onClick={() => setGrade(g.grade)} aria-pressed={g.grade === grade}>
              <b>{g.label}</b>
              <small>{packsForGrade(g.grade).length ? packsForGrade(g.grade).map((p) => p.title).join(' · ') : 'בקרוב'}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        בחרו דמות
        <AvatarGrid value={avatar} onPick={setAvatar} />
      </div>
      <div className="field">
        בחרו צבעים
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-btn ${t.id === theme ? 'selected' : ''}`}
              style={{ background: t.swatch.bg, color: t.swatch.ink }}
              onClick={() => setTheme(t.id)}
              aria-pressed={t.id === theme}
            >
              <span className="theme-dots" aria-hidden>
                <span style={{ background: t.swatch.accent }} />
                <span style={{ background: t.swatch.secondary }} />
                <span style={{ background: t.swatch.card, borderColor: t.swatch.secondary }} />
              </span>
              <span className="theme-name">{t.name}</span>
              <span className="theme-mood">{t.mood}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button className="btn primary" disabled={!name.trim()} onClick={() => onDone({ name: name.trim(), avatar, theme, grade })}>
          שמירה
        </button>
        {onCancel && (
          <button className="btn ghost" onClick={onCancel}>
            ביטול
          </button>
        )}
      </div>
    </div>
  );
}

export function Profiles({ onPick, onParent }: { onPick: (id: string) => void; onParent: () => void }) {
  const data = useData();
  const [adding, setAdding] = useState(data.profiles.length === 0);

  return (
    <div className="screen profiles">
      <header className="hero">
        <div className="hero-emoji">📚✨</div>
        <h1>לומדים</h1>
        <p>תרגול לפי תכנית משרד החינוך</p>
      </header>

      {adding ? (
        <>
          <h2 className="center">{data.profiles.length ? 'ילד/ה חדש/ה' : 'בואו נכיר! מי לומד/ת?'}</h2>
          <ProfileForm
            onDone={(fields) => {
              const id = actions.addProfile(fields);
              setAdding(false);
              onPick(id);
            }}
            onCancel={data.profiles.length ? () => setAdding(false) : undefined}
          />
        </>
      ) : (
        <>
          <h2 className="center">מי לומד/ת היום?</h2>
          <div className="profile-grid">
            {data.profiles.map((p) => (
              <button key={p.id} className="profile-card" onClick={() => onPick(p.id)}>
                <span className="avatar">{p.avatar}</span>
                <span className="pname">{p.name}</span>
                <span className="pstars">
                  {gradeLabel(p.grade)} · ⭐ {childProgress(data, p.id).stars}
                </span>
              </button>
            ))}
            <button className="profile-card add" onClick={() => setAdding(true)}>
              <span className="avatar">➕</span>
              <span className="pname">הוספה</span>
            </button>
          </div>
        </>
      )}
      <button className="link parent-link" onClick={onParent}>
        🔒 אזור הורים
      </button>
    </div>
  );
}
