import { useEffect, useState } from 'react';
import { getData, useData } from '../engine/store';
import { syncEnabled } from '../sync/client';
import {
  SyncError,
  adminStatus,
  inviteMessage,
  pendingInvites,
  createFamily,
  createPairing,
  familyChildren,
  familyDevices,
  invitePrimary,
  inviteParent,
  loadFamilies,
  pairThisDevice,
  pairedChildren,
  parentEmail,
  revokeDevice,
  shareChildren,
  signInWithGoogle,
  signOut,
  type Device,
  type Family,
  type ServerChild,
} from '../sync/family';

/** Read once at startup (see main.tsx): a refused Google sign-in. */
let startupError: string | null = null;
export const setStartupSignInError = (e: string | null) => (startupError = e);

const say = (e: unknown) => (e instanceof SyncError ? e.message : 'משהו השתבש. נסו שוב.');

/** The parent area's "family" cards. Shown only when the build has sync on. */
export function FamilySync() {
  if (!syncEnabled()) return null;
  return (
    <>
      <ParentAccount />
      <ThisDevice />
    </>
  );
}

function PrivacyNotice() {
  return (
    <div className="muted">
      <p>
        <strong>מה נשמר בשרת המשפחתי:</strong> כינויי הילדים (מוצפנים), האווטאר, הכיתה, וההתקדמות בתרגול ובמבחנים. כתובת האימייל משמשת רק
        להתחברות, ואי אפשר לקשר אותה לילדים מתוך מסד הנתונים.
      </p>
      <p>
        <strong>איפה:</strong> אצל Supabase, בשרת באוסטרליה (סידני). <strong>מי רואה:</strong> רק ההורים במשפחה והמכשירים שחיברתם.
      </p>
      <p>
        <strong>מחיקה:</strong> אפשר למחוק ילד/ה או את כל המשפחה בכל עת (כל ההורים מאשרים), והמחיקה מתבצעת תוך 48 שעות מסוף אותו יום.
      </p>
    </div>
  );
}

function ParentAccount() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(startupError);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    parentEmail()
      .then(setEmail)
      .catch(() => setEmail(null));
  }, []);

  if (email === undefined) return null;
  if (!email) {
    return (
      <div className="card">
        <h3>👨‍👩‍👧 המשפחה בשרת</h3>
        <p>הורים שהוזמנו יכולים לראות את ההתקדמות מכל מכשיר, ולחבר את הטלפונים של הילדים.</p>
        <PrivacyNotice />
        <label className="row">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>קראתי ואני מסכים/ה לשמירת הנתונים כמתואר.</span>
        </label>
        <button
          className="btn primary"
          disabled={!agree || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await signInWithGoogle();
            } catch (e) {
              setErr(say(e));
              setBusy(false);
            }
          }}
        >
          התחברות עם Google
        </button>
        {err && <p className="note">{err}</p>}
      </div>
    );
  }
  return <FamilyPanel email={email} onSignedOut={() => setEmail(null)} />;
}

function FamilyPanel({ email, onSignedOut }: { email: string; onSignedOut: () => void }) {
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const reload = () =>
    loadFamilies()
      .then((r) => setFamilies(r.families))
      .catch((e) => setErr(say(e)));
  useEffect(() => {
    void reload();
  }, []);

  const family = families?.[0];
  return (
    <div className="card">
      <h3>👨‍👩‍👧 המשפחה שלי</h3>
      {family && <p className="subtitle">{family.name}</p>}
      <p className="muted">מחובר/ת בתור {email}</p>
      {err && <p className="note">{err}</p>}
      {families && !family && (
        <>
          <p>עוד אין משפחה. אם קיבלתם הזמנה ליצירת משפחה, תנו לה שם:</p>
          <div className="row">
            <input value={name} maxLength={40} placeholder="שם המשפחה" onChange={(e) => setName(e.target.value)} />
            <button
              className="btn primary"
              disabled={!name.trim()}
              onClick={() =>
                createFamily(name.trim())
                  .then(reload)
                  .catch((e) => setErr(e instanceof SyncError && e.message.startsWith('אין הרשאה') ? 'לחשבון הזה אין הזמנה ליצירת משפחה.' : say(e)))
              }
            >
              יצירה
            </button>
          </div>
        </>
      )}
      {family && <FamilyDetails family={family} />}
      <div className="row">
        <button className="btn ghost" onClick={() => signOut().then(onSignedOut)}>
          התנתקות
        </button>
        <button
          className="btn ghost"
          onClick={() => confirm('להתנתק בכל המכשירים שבהם התחברתם? (למשל אם טלפון אבד)') && signOut(true).then(onSignedOut)}
        >
          התנתקות מכל המכשירים
        </button>
      </div>
    </div>
  );
}

function FamilyDetails({ family }: { family: Family }) {
  const data = useData();
  const [children, setChildren] = useState<ServerChild[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [invites, setInvites] = useState<{ expires_at: string }[]>([]);
  const [label, setLabel] = useState('');
  const [pick, setPick] = useState<string[]>([]);
  const [code, setCode] = useState<string | null>(null);

  const reload = () =>
    Promise.all([familyChildren(family.family_id), familyDevices(family.family_id), pendingInvites(family.family_id)])
      .then(([c, d, i]) => {
        setChildren(c.filter((x) => !x.deleted_at));
        setDevices(d);
        setInvites(i);
      })
      .catch((e) => setMsg(say(e)));
  useEffect(() => {
    void reload();
  }, [family.family_id]);

  const onServer = new Set(children.map((c) => c.id));
  const notShared = data.profiles.filter((p) => !onServer.has(p.id));
  const run = (p: Promise<unknown>, ok: string) =>
    p
      .then(() => {
        setMsg(ok);
        return reload();
      })
      .catch((e) => setMsg(say(e)));

  return (
    <>
      <h4>ילדים</h4>
      {children.length ? <p>{children.map((c) => `${c.avatar} ${c.name}`).join(' · ')}</p> : <p className="muted">עוד אין ילדים במשפחה.</p>}
      {notShared.length > 0 && (
        <button className="btn ghost" onClick={() => run(shareChildren(family.family_id, getData().profiles.filter((p) => !onServer.has(p.id))), 'הילדים נוספו ✓')}>
          הוספת הילדים מהמכשיר הזה ({notShared.map((p) => p.name).join(', ')})
        </button>
      )}

      <h4>מכשירים של הילדים</h4>
      {devices.filter((d) => !d.revoked_at).map((d) => (
        <div className="row" key={d.id}>
          <span>📱 {d.label ?? 'מכשיר'}</span>
          <button
            className="btn ghost"
            onClick={() => confirm(`לנתק את "${d.label ?? 'מכשיר'}"? הוא יאבד גישה מיד (למשל אם אבד).`) && run(revokeDevice(d.id), 'המכשיר נותק ✓')}
          >
            ניתוק
          </button>
        </div>
      ))}
      <p className="muted">חיבור טלפון של ילד/ה: בחרו ילדים, צרו קוד, והקלידו אותו בטלפון של הילד/ה (באזור ההורים שם). הקוד תקף 15 דקות.</p>
      <div className="row">
        {children.map((c) => (
          <label key={c.id}>
            <input
              type="checkbox"
              checked={pick.includes(c.id)}
              onChange={(e) => setPick((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))}
            />{' '}
            {c.name}
          </label>
        ))}
      </div>
      <div className="row">
        <input value={label} maxLength={40} placeholder="שם המכשיר (למשל: הטאבלט)" onChange={(e) => setLabel(e.target.value)} />
        <button
          className="btn primary"
          disabled={!pick.length}
          onClick={() =>
            createPairing(family.family_id, label, pick)
              .then((c) => setCode(c))
              .catch((e) => setMsg(say(e)))
          }
        >
          יצירת קוד
        </button>
      </div>
      {code && (
        <p className="pair-code" dir="ltr">
          {code.slice(0, 5)}-{code.slice(5)}
        </p>
      )}

      {family.role === 'primary' && (
        <>
          <h4>הזמנת הורה נוסף</h4>
          <InviteBox send={(email) => inviteParent(family.family_id, email)} newFamily={false} />
          <PendingList list={invites.map((i) => i.expires_at)} />
        </>
      )}
      <AdminBox />
      {msg && <p className="note">{msg}</p>}
    </>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

/** Pending invites, so the parent sees that inviting worked. The server keeps no addresses. */
function PendingList({ list }: { list: string[] }) {
  if (!list.length) return null;
  return <p className="muted">ממתינות {list.length === 1 ? 'הזמנה אחת' : `${list.length} הזמנות`} (בתוקף עד {list.map(day).join(', ')}).</p>;
}

/**
 * Invite by Google address. The app sends no email (Google-only sign-in, no mail provider): after the
 * invite is saved, the parent sends the invited person the message shown here (share or copy).
 */
function InviteBox({ send, newFamily, onSent }: { send: (email: string) => Promise<unknown>; newFamily: boolean; onSent?: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const text = sent ? inviteMessage(sent, newFamily) : '';
  return (
    <>
      <div className="row">
        <input type="email" dir="ltr" value={email} placeholder="email@gmail.com" onChange={(e) => setEmail(e.target.value)} />
        <button
          className="btn ghost"
          disabled={!email.trim()}
          onClick={() =>
            send(email)
              .then(() => {
                setSent(email);
                setEmail('');
                setErr(null);
                setCopied(false);
                onSent?.();
              })
              .catch((e) => setErr(say(e)))
          }
        >
          הזמנה
        </button>
      </div>
      {err && <p className="note">{err}</p>}
      {sent && (
        <div className="invite-sent">
          <p>
            <strong>ההזמנה נשמרה ✓</strong> האפליקציה לא שולחת אימייל. שלחו את ההודעה הזאת למי שהזמנתם (למשל בוואטסאפ):
          </p>
          <p className="invite-text">{text}</p>
          <div className="row">
            {typeof navigator.share === 'function' && (
              <button className="btn primary" onClick={() => navigator.share({ text }).catch(() => undefined)}>
                שיתוף
              </button>
            )}
            <button
              className="btn ghost"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(text)
                  .then(() => setCopied(true))
                  .catch(() => undefined)
              }
            >
              {copied ? 'הועתק ✓' : 'העתקה'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Admin only (shown when the server says this parent is the admin): invite the primary parent of a new family. */
function AdminBox() {
  const [st, setSt] = useState<{ isAdmin: boolean; primaryInvites: string[] } | null>(null);
  const load = () =>
    adminStatus()
      .then(setSt)
      .catch(() => setSt(null));
  useEffect(() => {
    void load();
  }, []);
  if (!st?.isAdmin) return null;
  return (
    <>
      <h4>
        ניהול <span className="badge">מנהל/ת ✓</span>
      </h4>
      <p className="muted">הזמנת הורה שיצור משפחה חדשה:</p>
      <InviteBox send={invitePrimary} newFamily onSent={() => void load()} />
      <PendingList list={st.primaryInvites} />
    </>
  );
}

/** On a child's phone: pair this device with the family (a parent types the code here). */
function ThisDevice() {
  const data = useData();
  const [kids, setKids] = useState<{ id: string; name: string }[] | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const load = () =>
    pairedChildren()
      .then(setKids)
      .catch(() => setKids(null));
  useEffect(() => {
    void load();
  }, []);

  if (kids === undefined) return null;
  return (
    <div className="card">
      <h3>📱 המכשיר הזה</h3>
      {kids && kids.length ? (
        <p>המכשיר מחובר למשפחה ✓ ילדים במכשיר: {kids.map((k) => k.name).join(', ')}</p>
      ) : (
        <>
          <p className="muted">יש לכם קוד חיבור מהורה? הקלידו אותו כאן כדי לחבר את המכשיר למשפחה.</p>
          <div className="row">
            <input dir="ltr" value={code} maxLength={11} placeholder="XXXXX-XXXXX" onChange={(e) => setCode(e.target.value)} />
            <button
              className="btn primary"
              disabled={code.replace(/[\s-]/g, '').length !== 10}
              onClick={() =>
                pairThisDevice(code, data.deviceId)
                  .then((ok) => {
                    setMsg(ok ? 'המכשיר חובר ✓' : 'הקוד לא נכון או שפג תוקפו.');
                    if (ok) setCode('');
                    return load();
                  })
                  .catch((e) => setMsg(say(e)))
              }
            >
              חיבור
            </button>
          </div>
        </>
      )}
      {msg && <p className="note">{msg}</p>}
    </div>
  );
}
