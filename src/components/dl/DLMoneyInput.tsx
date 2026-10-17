import { flushSync } from "react-dom";
import { useState } from "react";
import { formatMoney, parseScaledInput } from "../../services/dlPlanning";

export default function DLMoneyInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  label: string;
}) {
  const [focused, setFocused] = useState(false);
  let display = value;
  if (!focused) {
    try {
      const cents = parseScaledInput(value, 2, "Preço previsto");
      if (cents !== null) display = formatMoney(cents);
    } catch {
      /* Keep invalid input visible for correction. */
    }
  }
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      disabled={disabled}
      value={display}
      onFocus={(event) => {
        const input = event.currentTarget;
        flushSync(() => setFocused(true));
        input.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
