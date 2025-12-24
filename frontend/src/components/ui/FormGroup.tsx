import React from 'react';

export interface FormGroupProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  help?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormGroup({
  label,
  htmlFor,
  required = false,
  error,
  help,
  children,
  className = '',
}: FormGroupProps) {
  return (
    <div className={`ds-form-group ${className}`.trim()}>
      {label && (
        <label htmlFor={htmlFor} className={required ? 'required' : ''}>
          {label}
        </label>
      )}
      {children}
      {error && <div className="ds-form-error">{error}</div>}
      {help && !error && <div className="ds-form-help">{help}</div>}
    </div>
  );
}

// Form Row for side-by-side fields
export interface FormRowProps {
  children: React.ReactNode;
  columns?: 2 | 3;
  className?: string;
}

export function FormRow({ children, columns = 2, className = '' }: FormRowProps) {
  const colClass = columns === 3 ? 'ds-form-row-3' : 'ds-form-row';
  return <div className={`${colClass} ${className}`.trim()}>{children}</div>;
}

// Input component with design system styling
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <input
      className={`ds-input ${error ? 'error' : ''} ${className}`.trim()}
      {...props}
    />
  );
}

// Select component with design system styling
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  children: React.ReactNode;
}

export function Select({ error, className = '', children, ...props }: SelectProps) {
  return (
    <select
      className={`ds-select ${error ? 'error' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </select>
  );
}

// Textarea component with design system styling
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      className={`ds-textarea ${error ? 'error' : ''} ${className}`.trim()}
      {...props}
    />
  );
}

// Checkbox component
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function Checkbox({ label, className = '', ...props }: CheckboxProps) {
  return (
    <label className={`ds-checkbox ${className}`.trim()}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

// Radio component
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function Radio({ label, className = '', ...props }: RadioProps) {
  return (
    <label className={`ds-radio ${className}`.trim()}>
      <input type="radio" {...props} />
      <span>{label}</span>
    </label>
  );
}

export default FormGroup;
