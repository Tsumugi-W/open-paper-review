import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const variantStyles = {
    primary:
      "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] focus:ring-[var(--color-primary)]",
    secondary:
      "border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-secondary)] focus:ring-[var(--color-primary)]",
    danger:
      "bg-[var(--color-danger)] text-white hover:opacity-90 focus:ring-[var(--color-danger)]",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
