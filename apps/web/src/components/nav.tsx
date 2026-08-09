"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/papers", label: "Papers" },
  { href: "/reviews", label: "Reviews" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col">
      <div className="p-6">
        <Link href="/" className="text-xl font-bold">
          OpenPaperReview
        </Link>
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-secondary)]">
          OpenPaperReview v0.1.0
        </p>
      </div>
    </aside>
  );
}
