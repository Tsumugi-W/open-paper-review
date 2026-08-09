import Link from "next/link";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReviewProgress } from "@/components/review-progress";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReviewDetailPage({ params }: Props) {
  const { id } = await params;

  // TODO: Fetch review from DB
  const review = {
    id,
    paperId: "paper-1",
    paperTitle: "Sample Paper",
    venue: "NeurIPS",
    status: "running",
    language: "en",
    createdAt: new Date().toISOString(),
    stages: [
      { name: "Parsing", status: "completed" },
      { name: "Initial Read", status: "completed" },
      { name: "Detailed Analysis", status: "running" },
      { name: "Scoring", status: "pending" },
      { name: "Report Generation", status: "pending" },
    ],
  };

  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/reviews"
              className="text-sm text-[var(--color-text-secondary)] hover:underline mb-2 block"
            >
              &larr; Back to Reviews
            </Link>
            <h1 className="text-3xl font-bold">Review: {review.paperTitle}</h1>
          </div>
          <div className="flex gap-2">
            {review.status === "completed" && (
              <Link href={`/reviews/${id}/report`}>
                <Button>View Report</Button>
              </Link>
            )}
            {review.status === "running" && (
              <form action={`/api/v1/reviews/${id}/cancel`} method="POST">
                <Button type="submit" variant="danger">
                  Cancel
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ReviewProgress reviewId={id} initialStages={review.stages} />
          </div>

          <div className="space-y-6">
            <Card>
              <h2 className="text-lg font-semibold mb-4">Details</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Paper</dt>
                  <dd>
                    <Link
                      href={`/papers/${review.paperId}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {review.paperTitle}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Venue</dt>
                  <dd>{review.venue}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Language</dt>
                  <dd>{review.language === "en" ? "English" : "Chinese"}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Status</dt>
                  <dd className="capitalize">{review.status}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Created</dt>
                  <dd>{new Date(review.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
