import React from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  className?: string;
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  className = '',
}: FilterFieldProps) {
  return (
    <div className={`ds-filter-group ${className}`.trim()}>
      {label && <label>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface FilterInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date' | 'number';
  placeholder?: string;
  className?: string;
}

export function FilterInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  className = '',
}: FilterInputProps) {
  return (
    <div className={`ds-filter-group ${className}`.trim()}>
      {label && <label>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className = '' }: FilterBarProps) {
  return <div className={`ds-filters ${className}`.trim()}>{children}</div>;
}

export default FilterBar;
