import { useEffect, useState } from 'react';
import { actions, childProgress, useData } from '../engine/store';
import { THEMES, applyTheme, validTheme } from '../themes';

export const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐵', '🦄', '🐙', '🐯', '🐨', '🐧', '🦖', '🐬', '🚀', '⚽', '🎨', '🌟'];

export function ProfileForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: { name: string; avatar: string; theme?: string };
  onDone: (name: string, avatar: string, theme: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATARS[0]);
  const [theme, setTheme] = useState(validTheme(initial?.theme));

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
        בחרו דמות
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button key={a} className={`avatar-btn ${a === avatar ? 'selected' : ''}`} onClick={() => setAvatar(a)} aria-label={a}>
              {a}
            </button>
          ))}
        </div>
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
        <button className="btn primary" disabled={!name.trim()} onClick={() => onDone(name.trim(), avatar, theme)}>
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
        <div className="hero-emoji">🧮✨</div>
        <h1>לומדים חשבון</h1>
        <p>כיתה ה׳ · לפי תכנית משרד החינוך</p>
      </header>

      {adding ? (
        <>
          <h2 className="center">{data.profiles.length ? 'ילד/ה חדש/ה' : 'בואו נכיר! מי לומד/ת?'}</h2>
          <ProfileForm
            onDone={(n, a, th) => {
              const id = actions.addProfile(n, a, th);
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
                <span className="pstars">⭐ {childProgress(data, p.id).stars}</span>
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
