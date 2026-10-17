import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

type Props = {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  selected?: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
};

export default function CatalogActionMenu({ label, icon, disabled = false, selected, options, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [menuLeft, setMenuLeft] = useState<number>();
  const menu = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!root.current || !menu.current) return;
      const bounds = root.current.getBoundingClientRect();
      const width = menu.current.getBoundingClientRect().width;
      setMenuLeft(Math.max(12 - bounds.left, Math.min(bounds.width - width, window.innerWidth - 12 - bounds.left - width)));
    };
    position(); window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="catalog-action-menu" ref={root}>
    <button type="button" className="secondary-button" ref={trigger} disabled={disabled} aria-expanded={open} onClick={() => setOpen(!open)}>{icon}<span>{label}</span><ChevronDown size={14} aria-hidden="true" /></button>
    {open && !disabled && <div ref={menu} style={{ left: menuLeft, right: "auto" }} className="catalog-action-options" role="group" aria-label={label}>
      {options.map(option => <button type="button" key={option.value} aria-pressed={selected === undefined ? undefined : selected === option.value} onClick={() => { onSelect(option.value); setOpen(false); trigger.current?.focus(); }}><span>{option.label}</span>{selected === option.value && <Check size={15} aria-hidden="true" />}</button>)}
    </div>}
  </div>;
}
