import React from "react";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = "", children }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-6 ${className}`}
    >
      {children}
    </div>
  );
}
