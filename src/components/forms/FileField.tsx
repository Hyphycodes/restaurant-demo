'use client';

import { useId, useRef, useState } from 'react';

/**
 * An optional attachment: a résumé, a few photographs.
 *
 * A native file input styled to match the rest of the form, with the one
 * thing the native control does not give you — a plain sentence when the file
 * is too big or the wrong kind, said HERE, before somebody taps Send and waits
 * for an upload that was never going to be accepted. The server re-checks
 * everything (`src/server/uploads.ts`); this is courtesy, not security.
 *
 * Nothing here can block a submission. If a file is refused the input is
 * cleared and the form still sends — an attachment must never cost somebody
 * their application.
 */

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function FileField({
  name,
  label,
  hint,
  accept,
  multiple = false,
  maxFiles = 1,
  maxBytes,
}: {
  name: string;
  label: string;
  hint: string;
  /** The `accept` attribute — what the picker offers first. */
  accept: string;
  multiple?: boolean;
  maxFiles?: number;
  maxBytes: number;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ name: string; size: number }[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    if (files.length === 0) {
      setChosen([]);
      setProblem(null);
      return;
    }

    const tooBig = files.find((file) => file.size > maxBytes);
    if (tooBig) {
      setProblem(
        `${tooBig.name} is ${formatSize(tooBig.size)} — the limit is ${formatSize(maxBytes)}. Send it over after we talk, or paste a link instead.`,
      );
      setChosen([]);
      if (input.current) input.current.value = '';
      return;
    }
    if (files.length > maxFiles) {
      setProblem(`Pick up to ${maxFiles} ${maxFiles === 1 ? 'file' : 'files'}.`);
      setChosen([]);
      if (input.current) input.current.value = '';
      return;
    }

    setProblem(null);
    setChosen(files.map((file) => ({ name: file.name, size: file.size })));
  }

  function clear() {
    if (input.current) input.current.value = '';
    setChosen([]);
    setProblem(null);
  }

  return (
    <div>
      <label htmlFor={id} className="block text-[0.875rem] font-medium text-brown">
        {label}
        <span className="font-normal text-brown-soft"> (optional)</span>
      </label>
      <p id={`${id}-hint`} className="mt-1 text-[0.8125rem] text-brown-soft">
        {hint}
      </p>

      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        aria-describedby={`${id}-hint${problem ? ` ${id}-error` : ''}`}
        aria-invalid={problem ? true : undefined}
        className="mt-1.5 block w-full cursor-pointer rounded-(--radius-sm) border border-brown/25 bg-linen text-[0.9375rem] text-brown-soft file:mr-4 file:cursor-pointer file:border-0 file:border-r file:border-brown/20 file:bg-brown/6 file:px-4 file:py-3 file:text-[0.9375rem] file:font-semibold file:text-brown hover:file:bg-brown/10"
      />

      {problem ? (
        <p id={`${id}-error`} className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {problem}
        </p>
      ) : null}

      {chosen.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-brown-soft">
          <span className="min-w-0">
            {chosen.map((file) => `${file.name} (${formatSize(file.size)})`).join(', ')}
          </span>
          <button
            type="button"
            onClick={clear}
            className="inline-flex min-h-11 items-center font-semibold text-clay underline underline-offset-4"
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}
