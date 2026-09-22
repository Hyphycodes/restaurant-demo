import type { ReactNode } from 'react';

const CONTROL =
  'w-full min-h-11 rounded-(--radius-sm) border border-brown/25 bg-linen px-3.5 py-2.5 ' +
  'text-[0.9375rem] text-brown placeholder:text-brown-soft/70 ' +
  'transition-colors focus:border-brown/50 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:border-2';

interface BaseProps {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

function Wrapper({
  name,
  label,
  error,
  hint,
  required,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="block text-[0.875rem] font-medium text-brown">
        {label}
        {required ? (
          <span className="text-clay">
            {' '}
            *<span className="sr-only"> (required)</span>
          </span>
        ) : (
          <span className="font-normal text-brown-soft"> (optional)</span>
        )}
      </label>
      {hint ? (
        <p id={`${name}-hint`} className="mt-1 text-[0.8125rem] text-brown-soft">
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** `aria-describedby` wires hint + error to the control so both are announced. */
function described(name: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export function TextField({
  type = 'text',
  autoComplete,
  placeholder,
  min,
  max,
  // `inputMode` is what actually changes the keyboard on a phone: `type="tel"`
  // alone leaves some browsers on the full QWERTY.
  inputMode,
  ...props
}: BaseProps & {
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  inputMode?: 'text' | 'tel' | 'email' | 'url' | 'numeric';
}) {
  return (
    <Wrapper {...props}>
      <input
        id={props.name}
        name={props.name}
        type={type}
        required={props.required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        min={min}
        max={max}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={described(props.name, props.hint, props.error)}
        className={CONTROL}
      />
    </Wrapper>
  );
}

export function TextArea({
  rows = 4,
  placeholder,
  ...props
}: BaseProps & { rows?: number; placeholder?: string }) {
  return (
    <Wrapper {...props}>
      <textarea
        id={props.name}
        name={props.name}
        rows={rows}
        required={props.required}
        placeholder={placeholder}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={described(props.name, props.hint, props.error)}
        className={CONTROL}
      />
    </Wrapper>
  );
}

export function SelectField({
  options,
  defaultValue,
  placeholder = 'Choose one',
  ...props
}: BaseProps & {
  options: { value: string; label: string }[];
  /** Preselects a choice — a role somebody pressed Apply on, say. */
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <Wrapper {...props}>
      <select
        id={props.name}
        name={props.name}
        required={props.required}
        defaultValue={defaultValue ?? ''}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={described(props.name, props.hint, props.error)}
        className={CONTROL}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function CheckboxField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-[0.9375rem] text-brown">
      <input
        id={name}
        name={name}
        type="checkbox"
        value="true"
        className="size-5 rounded-(--radius-sm) border-brown/40 accent-[var(--color-orange)]"
      />
      {label}
    </label>
  );
}

/** Hidden from humans and assistive tech; bots fill it and get rejected. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
      <label htmlFor="company_website">Company website</label>
      <input id="company_website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
