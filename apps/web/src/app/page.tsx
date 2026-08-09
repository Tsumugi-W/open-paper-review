import Link from "next/link";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Total Papers
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
          </Card>
          <Card>
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Active Reviews
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
          </Card>
          <Card>
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Completed Reviews
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
          </Card>
        </div>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Papers</h2>
            <Link
              href="/papers"
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              View all
            </Link>
          </div>
          <Card>
            <p className="text-[var(--color-text-secondary)] text-center py-8">
              No papers yet.{" "}
              <Link href="/papers/upload" className="text-[var(--color-primary)] hover:underline">
                Upload your first paper
              </Link>
            </p>
          </Card>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Reviews</h2>
            <Link
              href="/reviews"
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              View all
            </Link>
          </div>
          <Card>
            <p className="text-[var(--color-text-secondary)] text-center py-8">
              No reviews yet.{" "}
              <Link href="/reviews/new" className="text-[var(--color-primary)] hover:underline">
                Start a review
              </Link>
            </p>
          </Card>
        </section>
      </main>
    </>
  );
}
