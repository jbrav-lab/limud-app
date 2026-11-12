import { Fragment, type ReactNode } from 'react';

/**
 * Renders the small markup language used in topics:
 *   {3/4} fraction, {2 3/4} mixed number, [[...]] left-to-right math, **bold**, \n line break.
 */
const TOKEN = /(\[\[[\s\S]*?\]\]|\*\*[\s\S]*?\*\*|\{[^{}]*\}|\n)/g;
const MIXED = /^(\d+) (\d+)\/(\d+)$/;

function Frac({ body }: { body: string }) {
  const m = body.match(MIXED);
  if (m) {
    return (
      <span className="mixed" dir="ltr">
        <span className="whole">{m[1]}</span>
        <Frac body={`${m[2]}/${m[3]}`} />
      </span>
    );
  }
  const i = body.indexOf('/');
  if (i < 0) return <>{`{${body}}`}</>;
  return (
    <span className="frac" dir="ltr">
      <span className="num">{body.slice(0, i).trim()}</span>
      <span className="den">{body.slice(i + 1).trim()}</span>
    </span>
  );
}

function parse(text: string, inLtr = false): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part === '\n') return <br key={i} />;
    if (part.startsWith('[[') && part.endsWith(']]'))
      return (
        <span key={i} className="ltr" dir="ltr">
          {parse(part.slice(2, -2), true)}
        </span>
      );
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{parse(part.slice(2, -2), inLtr)}</strong>;
    if (part.startsWith('{') && part.endsWith('}')) return <Frac key={i} body={part.slice(1, -1)} />;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function MathText({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{parse(text)}</span>;
}

/** A whole expression shown left-to-right, e.g. "3/4 + 1/2 = ?" */
export function Expression({ text }: { text: string }) {
  return (
    <div className="expression" dir="ltr">
      {parse(text, true)}
    </div>
  );
}
