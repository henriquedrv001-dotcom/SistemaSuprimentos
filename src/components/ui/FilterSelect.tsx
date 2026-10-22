import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "./InterfaceModels.css";

export type FilterOption = {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
};

/** UI-FLT-01: select-only combobox. Filters values without persisting data. */
export default function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
}: {
  label?: string;
  "aria-label"?: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);
  const enabled = options.flatMap((option, i) => (option.disabled ? [] : [i]));
  function show() {
    const index = options.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    setActive(index >= 0 ? index : (enabled[0] ?? 0));
    search.current = { text: "", at: 0 };
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (key === "Tab") {
      setOpen(false);
      return;
    }
    if (key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      if (!open) show();
      const position = enabled.indexOf(active);
      if (key === "Home") setActive(enabled[0] ?? 0);
      else if (key === "End") setActive(enabled.at(-1) ?? 0);
      else if (open)
        setActive(
          enabled[
            Math.max(
              0,
              Math.min(
                enabled.length - 1,
                position + (key === "ArrowDown" ? 1 : -1),
              ),
            )
          ] ?? 0,
        );
      return;
    }
    if (
      key === "Enter" ||
      (key === " " &&
        (!search.current.text || Date.now() - search.current.at > 700))
    ) {
      event.preventDefault();
      if (open) choose(active);
      else show();
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!open) show();
      const normalize = (text: string) =>
        text
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("pt-BR");
      const now = Date.now();
      const text =
        now - search.current.at > 700 ? key : search.current.text + key;
      search.current = { text, at: now };
      const prefix = normalize(text);
      // Repeating a single letter cycles through matching choices.
      const repeated = [...prefix].every((letter) => letter === prefix[0]);
      const sequence = repeated
        ? [
            ...enabled.filter((i) => i > active),
            ...enabled.filter((i) => i <= active),
          ]
        : enabled;
      const match = sequence.find((i) =>
        normalize(options[i].label).startsWith(repeated ? prefix[0] : prefix),
      );
      if (match !== undefined) setActive(match);
    }
  }
  useLayoutEffect(() => {
    if (!open || !popup.current || !trigger.current) return;
    const list = popup.current;
    list.setAttribute("popover", "manual");
    list.showPopover?.();
    function position() {
      if (!trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? innerWidth;
      const height = viewport?.height ?? innerHeight;
      if (
        rect.bottom < top ||
        rect.top > top + height ||
        rect.right < left ||
        rect.left > left + width
      ) {
        setOpen(false);
        return;
      }
      const below = Math.max(0, top + height - rect.bottom - 12);
      const above = Math.max(0, rect.top - top - 12);
      const up = below < 200 && above > below;
      const available = up ? above : below;
      list.style.width = `${Math.min(Math.max(rect.width, 220), width - 16)}px`;
      list.style.maxHeight = `${Math.min(300, available)}px`;
      list.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - list.offsetWidth - 8))}px`;
      list.style.top = `${up ? rect.top - list.offsetHeight - 6 : rect.bottom + 6}px`;
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(trigger.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      if (list.matches(":popover-open")) list.hidePopover();
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      const node = event.target as Node;
      if (!trigger.current?.contains(node) && !popup.current?.contains(node))
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return (
    <div className="ui-filter-field ui-select">
      {label && <label htmlFor={id}>{label}</label>}
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        className="ui-select-trigger"
        disabled={disabled}
        aria-label={ariaLabel || label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={
          open && options[active] ? `${id}-option-${active}` : undefined
        }
        onKeyDown={keyDown}
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={(event) => {
          if (!popup.current?.contains(event.relatedTarget as Node))
            setOpen(false);
        }}
      >
        <span title={selected?.label}>{selected?.label || "Selecionar"}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel || label}
            className="ui-select-popup"
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.map((option, i) => (
              <Fragment key={option.value}>
                {option.group && option.group !== options[i - 1]?.group && (
                  <div className="ui-select-group-heading" aria-hidden="true">
                    {option.group}
                  </div>
                )}
                <div
                  id={`${id}-option-${i}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  data-active={i === active}
                  className="ui-select-option"
                  onPointerMove={() => {
                    if (!option.disabled) setActive(i);
                  }}
                  onClick={() => choose(i)}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <Check size={15} aria-hidden="true" />
                  )}
                </div>
              </Fragment>
            ))}
            {!options.length && (
              <div className="ui-select-empty">Nenhuma opção disponível</div>
            )}
          </div>,
          trigger.current?.closest("dialog") || document.body,
        )}
    </div>
  );
}
