/**
 * Shown instead of the app when the data on this device was saved by a newer version of the app
 * (this copy is old: a tab left open, or an old cached copy). This copy never writes, so the newer
 * data is safe; reloading loads the new version.
 */
export function NewerData() {
  return (
    <div className="screen">
      <div className="card">
        <h2 className="center">יש גרסה חדשה של האפליקציה</h2>
        <p>הנתונים במכשיר נשמרו בגרסה חדשה יותר. כדי לא לפגוע בהם, הגרסה הזאת לא תשמור דבר.</p>
        <p className="muted">טענו מחדש את הדף. אם אין חיבור לאינטרנט, התחברו ונסו שוב.</p>
        <button className="btn primary" onClick={() => location.reload()}>
          טעינה מחדש
        </button>
      </div>
    </div>
  );
}
