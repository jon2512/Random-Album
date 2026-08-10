"use client";

import { SPIN_MODES, type SpinMode } from "@/lib/modes";

type Props = {
  value: SpinMode;
  onChange: (mode: SpinMode) => void;
  disabled?: boolean;
};

export default function ModeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="mode-selector">
      <p className="mode-selector__label">Mode</p>
      <div className="mode-selector__row" role="listbox" aria-label="Listening mode">
        {SPIN_MODES.map((mode) => {
          const active = value === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="option"
              aria-selected={active}
              className={`mode-chip ${active ? "is-active" : ""}`}
              disabled={disabled}
              title={mode.hint}
              onClick={() => onChange(mode.id)}
            >
              <span className="mode-chip__name">{mode.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
