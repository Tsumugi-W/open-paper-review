import Link from "next/link";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-200 text-gray-800",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-yellow-100 text-yellow-800",
};

export default function ReviewsPage() {
  // TODO: Fetch reviews from DB
  const reviews: Array<{
    id: string;
    paperTitle: string;
    venue: string;
    status: string;
    createdAt: string;
  }> = [];

  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Reviews</h1>
          <Link href="/reviews/new">
            <Button>New Review</Button>
          </Link>
        </div>

        {reviews.length === 0 ? (
          <Card>
            <p className="text-[var(--color-text-secondary)] text-center py-12">
              No reviews yet.{" "}
              <Link href="/reviews/new" className="text-[var(--color-primary)] hover:underline">
                Start your first review
              </Link>
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Link key={review.id} href={`/reviews/${review.id}`}>
                <Card className="hover:border-[var(--color-primary)] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{review.paperTitle}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {review.venue}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[review.status] ?? ""}`}
                      >
                        {review.status}
                      </span>
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {review.createdAt}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
