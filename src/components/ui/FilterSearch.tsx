import { useId } from "react";
import { Search } from "lucide-react";
import "./InterfaceModels.css";

export default function FilterSearch({
  label,
  "aria-label": ariaLabel,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  "aria-label"?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="ui-filter-field ui-filter-search">
      <label htmlFor={id}>{label}</label>
      <div className="ui-search-control">
        <Search size={16} aria-hidden="true" />
        <input
          id={id}
          type="search"
          aria-label={ariaLabel || label}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
