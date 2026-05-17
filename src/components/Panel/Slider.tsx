import { useEffect, useId, useState } from "react";

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  format?: (v: number) => string;
  parse?: (s: string) => number | null;
  active?: boolean;
  warn?: boolean;
};

export default function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = "",
  format,
  parse,
  active,
  warn,
}: Props) {
  const id = useId();
  const display = format ? format(value) : value.toFixed(step < 1 ? 1 : 0);
  const [text, setText] = useState(display);

  useEffect(() => {
    setText(display);
  }, [display]);

  const commit = (raw: string) => {
    const parsed = parse ? parse(raw) : parseFloat(raw);
    if (parsed != null && Number.isFinite(parsed)) {
      onChange(parsed);
    } else {
      setText(display);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400">
        <label htmlFor={id} className="flex items-center gap-1">
          {active && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-tac-accent"
              aria-label="active"
            />
          )}
          {label}
        </label>
        <div
          className={`flex items-center gap-1 font-mono ${
            warn ? "text-tac-warn" : "text-slate-100"
          }`}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commit((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                setText(display);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-16 rounded bg-tac-bg px-1 py-0.5 text-right ring-1 ring-tac-border focus:outline-none focus:ring-tac-accent"
            inputMode="decimal"
          />
          <span className="text-slate-500">{suffix.trim()}</span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onClick={(e) => e.stopPropagation()}
        className="h-1.5 w-full cursor-pointer appearance-none rounded bg-tac-border accent-tac-accent"
      />
    </div>
  );
}
