'use client';

import { useEffect, useRef } from 'react';

/**
 * Bold, italic, links, lists. Nothing more.
 *
 * A contenteditable with four buttons. What it produces is sanitised on the
 * server against an allow-list, so nothing this control can be tricked into
 * emitting reaches a page.
 */
export function RichTextField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value && document.activeElement !== ref.current) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML ?? '');
  };
  const link = () => {
    const url = window.prompt('Link to (https://…)');
    if (url && /^https?:\/\//i.test(url)) run('createLink', url);
  };
  const button = 'inline-flex min-h-9 min-w-9 items-center justify-center rounded-(--radius-sm) border border-brown/20 px-2 text-[0.8125rem] font-semibold text-brown hover:border-brown/45 disabled:opacity-50';

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1.5" role="toolbar" aria-label="Formatting">
        <button type="button" className={button} onMouseDown={(e) => e.preventDefault()} onClick={() => run('bold')} disabled={disabled} aria-label="Bold"><strong>B</strong></button>
        <button type="button" className={button} onMouseDown={(e) => e.preventDefault()} onClick={() => run('italic')} disabled={disabled} aria-label="Italic"><em>I</em></button>
        <button type="button" className={button} onMouseDown={(e) => e.preventDefault()} onClick={link} disabled={disabled}>Link</button>
        <button type="button" className={button} onMouseDown={(e) => e.preventDefault()} onClick={() => run('insertUnorderedList')} disabled={disabled}>List</button>
      </div>
      <div
        id={id}
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        onBlur={() => onChange(ref.current?.innerHTML ?? '')}
        className="event-prose min-h-32 rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 text-[0.9375rem] leading-relaxed text-brown focus:border-clay focus:outline-none"
      />
    </div>
  );
}
