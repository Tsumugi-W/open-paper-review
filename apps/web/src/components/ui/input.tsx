import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
