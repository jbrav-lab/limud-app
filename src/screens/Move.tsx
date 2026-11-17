import { useState } from 'react';
import { NEW_URL, handoffResult, isOldAddress, sendToNewAddress } from '../engine/move';

/** On the old address only: the app has moved; one tap hands this device's progress to the new address. */
export function MoveBanner() {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed' | 'blocked'>('idle');
  if (!isOldAddress()) return null;
  return (
    <div className="card move">
      <h3>האפליקציה עוברת לכתובת חדשה</h3>
      {state === 'done' ? (
        <p>
          ההתקדמות הועברה ✓ מעכשיו פתחו את <a href={NEW_URL}>הכתובת החדשה</a>. אם האפליקציה על מסך הבית, הסירו את הסמל הישן והוסיפו את החדש
          מהכתובת החדשה.
        </p>
      ) : (
        <>
          <p>הכתובת החדשה בטוחה יותר. ההתקדמות של כל הילדים במכשיר הזה עוברת בלחיצה אחת, ישירות מהדפדפן.</p>
          <button
            className="btn primary"
            disabled={state === 'busy'}
            onClick={async () => {
              setState('busy');
              setState(await sendToNewAddress());
            }}
          >
            {state === 'busy' ? 'מעבירים…' : 'העברת ההתקדמות לכתובת החדשה'}
          </button>
          {state === 'blocked' && <p className="note">הדפדפן חסם את פתיחת הכתובת החדשה. אפשרו חלונות קופצים ונסו שוב.</p>}
          {state === 'failed' && (
            <p className="note">
              ההעברה לא הצליחה. אפשר להעביר בגיבוי: באזור ההורים ← שמירת גיבוי כאן, ואז בכתובת החדשה ← שחזור מגיבוי.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** On the new address, once: the result of a handoff from the old address. */
export function MoveNotice() {
  const [open, setOpen] = useState(true);
  const r = handoffResult();
  if (!r || !open) return null;
  return (
    <div className="card move">
      <p>{r === 'merged' ? 'ההתקדמות הועברה מהכתובת הישנה ✓' : 'ההעברה מהכתובת הישנה לא הצליחה. אפשר להעביר בגיבוי מאזור ההורים.'}</p>
      <button className="btn ghost" onClick={() => setOpen(false)}>
        סגירה
      </button>
    </div>
  );
}
