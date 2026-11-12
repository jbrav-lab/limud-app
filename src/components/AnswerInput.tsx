import { useEffect, useRef } from 'react';
import type { Answer } from '../engine/types';
import type { UserAnswer } from '../engine/check';
import { MathText } from './MathText';

export function emptyUserAnswer(a: Answer): UserAnswer {
  switch (a.kind) {
    case 'number':
      return { kind: 'number', text: '' };
    case 'fraction':
      return { kind: 'fraction', whole: '', num: '', den: '' };
    case 'choice':
      return { kind: 'choice', index: -1 };
    case 'compare':
      return { kind: 'compare', value: '=' as const };
    case 'divRem':
      return { kind: 'divRem', q: '', r: '' };
    case 'multi':
      return { kind: 'multi', picked: [] };
    case 'order':
      return { kind: 'order', seq: [...a.start] };
    case 'match':
      return { kind: 'match', chosen: a.pairs.map(() => -1) };
  }
}

interface Props {
  answer: Answer;
  value: UserAnswer;
  onChange: (u: UserAnswer) => void;
  onSubmit: (u?: UserAnswer) => void;
  disabled: boolean;
  /** After checking: highlight right/wrong (choice/compare use the fields; multi/order/match read the answer itself) */
  reveal?: { correctIndex?: number; picked?: number; correctSign?: string };
  /** Test mode: mark the option the child picked (neutral color, no right/wrong yet). */
  showSelection?: boolean;
}

const digitsOnly = (s: string) => s.replace(/[^\d]/g, '').slice(0, 6);

export function AnswerInput({ answer, value, onChange, onSubmit, disabled, reveal, showSelection }: Props) {
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!disabled) first.current?.focus({ preventScroll: true });
  }, [answer, disabled]);

  const enter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
  };

  if (answer.kind === 'number' && value.kind === 'number') {
    return (
      <div className="answer-row">
        <input
          ref={first}
          className="num-input"
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          value={value.text}
          disabled={disabled}
          placeholder="?"
          onChange={(e) => onChange({ kind: 'number', text: e.target.value.replace(/[^\d.,\-]/g, '').slice(0, 12) })}
          onKeyDown={enter}
          aria-label="התשובה"
        />
        {answer.unit && <span className="ans-unit">{answer.unit}</span>}
      </div>
    );
  }

  if (answer.kind === 'fraction' && value.kind === 'fraction') {
    const showWhole = answer.allowWhole || answer.form === 'mixed' || answer.num > answer.den;
    return (
      <div className="answer-row" dir="ltr">
        {showWhole && (
          <input
            className="num-input whole-input"
            inputMode="numeric"
            value={value.whole}
            disabled={disabled}
            placeholder="שלם"
            onChange={(e) => onChange({ ...value, whole: digitsOnly(e.target.value) })}
            onKeyDown={enter}
            aria-label="שלמים"
          />
        )}
        <div className="frac-input">
          <input
            ref={first}
            className="num-input"
            inputMode="numeric"
            value={value.num}
            disabled={disabled}
            placeholder="מונה"
            onChange={(e) => onChange({ ...value, num: digitsOnly(e.target.value) })}
            onKeyDown={enter}
            aria-label="מונה"
          />
          <div className="frac-line" />
          <input
            className="num-input"
            inputMode="numeric"
            value={value.den}
            disabled={disabled}
            placeholder="מכנה"
            onChange={(e) => onChange({ ...value, den: digitsOnly(e.target.value) })}
            onKeyDown={enter}
            aria-label="מכנה"
          />
        </div>
      </div>
    );
  }

  if (answer.kind === 'divRem' && value.kind === 'divRem') {
    return (
      <div className="answer-row divrem">
        <label>
          מנה
          <input ref={first} className="num-input" dir="ltr" inputMode="numeric" value={value.q} disabled={disabled} onChange={(e) => onChange({ ...value, q: digitsOnly(e.target.value) })} onKeyDown={enter} />
        </label>
        <label>
          שארית
          <input className="num-input" dir="ltr" inputMode="numeric" value={value.r} disabled={disabled} onChange={(e) => onChange({ ...value, r: digitsOnly(e.target.value) })} onKeyDown={enter} />
        </label>
      </div>
    );
  }

  if (answer.kind === 'compare' && value.kind === 'compare') {
    return (
      <div className="choices compare" dir="ltr">
        {(['<', '=', '>'] as const).map((s) => (
          <button
            key={s}
            className={`choice big ${showSelection && value.value === s ? 'is-selected' : ''} ${reveal?.correctSign === s ? 'is-correct' : ''} ${reveal && reveal.correctSign !== s && value.value === s ? 'is-wrong' : ''}`}
            disabled={disabled}
            onClick={() => {
              onChange({ kind: 'compare', value: s });
              onSubmit({ kind: 'compare', value: s });
            }}
          >
            {s}
          </button>
        ))}
      </div>
    );
  }

  if (answer.kind === 'choice' && value.kind === 'choice') {
    return (
      <div className={`choices ${answer.options.some((o) => o.length > 18) ? 'stacked' : ''}`}>
        {answer.options.map((o, i) => (
          <button
            key={i}
            className={`choice ${showSelection && value.index === i ? 'is-selected' : ''} ${reveal?.correctIndex === i ? 'is-correct' : ''} ${reveal && reveal.correctIndex !== i && reveal.picked === i ? 'is-wrong' : ''}`}
            disabled={disabled}
            onClick={() => {
              onChange({ kind: 'choice', index: i });
              onSubmit({ kind: 'choice', index: i });
            }}
          >
            <MathText text={o} />
          </button>
        ))}
      </div>
    );
  }

  if (answer.kind === 'multi' && value.kind === 'multi') {
    const want = new Set(answer.correct);
    return (
      <div className="multi-wrap">
        <p className="input-help">אפשר לבחור יותר מתשובה אחת</p>
        <div className={`choices ${answer.options.some((o) => o.length > 18) ? 'stacked' : ''}`}>
          {answer.options.map((o, i) => {
            const on = value.picked.includes(i);
            const mark = reveal ? (want.has(i) ? 'is-correct' : on ? 'is-wrong' : '') : on ? 'is-selected' : '';
            return (
              <button
                key={i}
                className={`choice check-choice ${mark}`}
                disabled={disabled}
                aria-pressed={on}
                onClick={() => onChange({ kind: 'multi', picked: on ? value.picked.filter((x) => x !== i) : [...value.picked, i] })}
              >
                <span className="tick" aria-hidden>
                  {on ? '☑' : '☐'}
                </span>
                <MathText text={o} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (answer.kind === 'order' && value.kind === 'order') {
    const move = (from: number, to: number) => {
      const seq = [...value.seq];
      [seq[from], seq[to]] = [seq[to], seq[from]];
      onChange({ kind: 'order', seq });
    };
    return (
      <div className="order-wrap">
        <p className="input-help">סדרו בעזרת החצים: מה שבא ראשון – למעלה</p>
        <ol className="order-list">
          {value.seq.map((item, pos) => (
            <li key={item} className={reveal ? (item === pos ? 'is-correct' : 'is-wrong') : ''}>
              <span className="order-num">{pos + 1}</span>
              <span className="order-text">
                <MathText text={answer.items[item]} />
              </span>
              <span className="order-btns">
                <button disabled={disabled || pos === 0} onClick={() => move(pos, pos - 1)} aria-label="להזיז למעלה">
                  ▲
                </button>
                <button disabled={disabled || pos === value.seq.length - 1} onClick={() => move(pos, pos + 1)} aria-label="להזיז למטה">
                  ▼
                </button>
              </span>
            </li>
          ))}
        </ol>
        {showSelection === false && !disabled && (
          <button className="link small" onClick={() => onChange({ ...value })}>
            ✓ זה הסדר שלי
          </button>
        )}
      </div>
    );
  }

  if (answer.kind === 'match' && value.kind === 'match') {
    return (
      <div className="match-wrap">
        <p className="input-help">בחרו לכל פריט את ההתאמה שלו</p>
        {answer.pairs.map(([left, right], i) => {
          const ok = answer.rights[value.chosen[i]] === right;
          return (
            <label key={i} className={`match-row ${reveal ? (ok ? 'is-correct' : 'is-wrong') : ''}`}>
              <span className="match-left">
                <MathText text={left} />
              </span>
              <select
                value={value.chosen[i]}
                disabled={disabled}
                onChange={(e) => onChange({ kind: 'match', chosen: value.chosen.map((c, j) => (j === i ? Number(e.target.value) : c)) })}
              >
                <option value={-1}>בחרו…</option>
                {answer.rights.map((r, k) => (
                  <option key={k} value={k}>
                    {plain(r)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    );
  }
  return null;
}

/** Strip the text markup for places that can only show plain text (e.g. <option>). */
const plain = (t: string) => t.replace(/\[\[|\]\]|\*\*/g, '').replace(/\{(\d+) (\d+)\/(\d+)\}/g, '$1 $2/$3').replace(/\{([^{}]*)\}/g, '$1');

/** Human-readable (markup) version of a user's answer, for the parent's mistakes list. */
export function describeUser(u: UserAnswer, a: Answer): string {
  switch (u.kind) {
    case 'number':
      return `[[${u.text}]]`;
    case 'fraction':
      return u.num || u.den ? `[[${u.whole ? `{${u.whole} ${u.num}/${u.den}}` : `{${u.num}/${u.den}}`}]]` : `[[${u.whole}]]`;
    case 'choice':
      return a.kind === 'choice' ? a.options[u.index] ?? '' : '';
    case 'compare':
      return `[[${u.value}]]`;
    case 'divRem':
      return `${u.q} ושארית ${u.r}`;
    case 'multi':
      return a.kind === 'multi' ? u.picked.map((i) => a.options[i]).join(' · ') || '—' : '';
    case 'order':
      return a.kind === 'order' ? u.seq.map((i, pos) => `${pos + 1}. ${a.items[i]}`).join('  ') : '';
    case 'match':
      return a.kind === 'match' ? a.pairs.map(([l], i) => `${l} – ${a.rights[u.chosen[i]] ?? '?'}`).join(' · ') : '';
  }
}

export function describeCorrect(a: Answer): string {
  switch (a.kind) {
    case 'number':
      return `[[${a.value}]]${a.unit ? ' ' + a.unit : ''}`;
    case 'fraction': {
      if (a.num % a.den === 0) return `[[${a.num / a.den}]]`;
      return a.num > a.den ? `[[{${a.num}/${a.den}} = {${Math.floor(a.num / a.den)} ${a.num % a.den}/${a.den}}]]` : `[[{${a.num}/${a.den}}]]`;
    }
    case 'choice':
      return a.options[a.correct];
    case 'compare':
      return `[[${a.correct}]]`;
    case 'divRem':
      return `${a.q} ושארית ${a.r}`;
    case 'multi':
      return a.correct.map((i) => a.options[i]).join(' · ');
    case 'order':
      return a.items.map((t, i) => `${i + 1}. ${t}`).join('  ');
    case 'match':
      return a.pairs.map(([l, r]) => `${l} – ${r}`).join(' · ');
  }
}
