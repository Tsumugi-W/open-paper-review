import Link from "next/link";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">Admin</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Team Members
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
          </Card>
          <Card>
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Model Profiles
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
          </Card>
          <Card>
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Venue Bundles
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
          </Card>
          <Card>
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Total Usage
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/admin/members">
            <Card className="hover:border-[var(--color-primary)] transition-colors cursor-pointer">
              <h2 className="text-lg font-semibold mb-2">Team Members</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Manage team members and their roles.
              </p>
            </Card>
          </Link>

          <Link href="/admin/models">
            <Card className="hover:border-[var(--color-primary)] transition-colors cursor-pointer">
              <h2 className="text-lg font-semibold mb-2">Model Profiles</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Configure AI model profiles and settings.
              </p>
            </Card>
          </Link>

          <Link href="/admin/venues">
            <Card className="hover:border-[var(--color-primary)] transition-colors cursor-pointer">
              <h2 className="text-lg font-semibold mb-2">Venue Bundles</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Manage venue configurations and criteria.
              </p>
            </Card>
          </Link>
        </div>
      </main>
    </>
  );
}
