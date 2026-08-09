import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaperDetailPage({ params }: Props) {
  const { id } = await params;

  // TODO: Fetch paper from DB
  // const paper = await getPaper(id);
  // if (!paper) notFound();

  const paper = {
    id,
    title: "Paper Title",
    authors: ["Author 1", "Author 2"],
    abstract: "Paper abstract goes here.",
    pageCount: 10,
    uploadedAt: new Date().toISOString(),
    source: "upload" as const,
    arxivId: null as string | null,
  };

  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/papers"
              className="text-sm text-[var(--color-text-secondary)] hover:underline mb-2 block"
            >
              &larr; Back to Papers
            </Link>
            <h1 className="text-3xl font-bold">{paper.title}</h1>
          </div>
          <Link href={`/reviews/new?paperId=${paper.id}`}>
            <Button>Start Review</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h2 className="text-lg font-semibold mb-2">Abstract</h2>
              <p className="text-[var(--color-text-secondary)]">{paper.abstract}</p>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold mb-4">Pages Preview</h2>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: paper.pageCount }, (_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded flex items-center justify-center text-sm text-[var(--color-text-secondary)]"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <h2 className="text-lg font-semibold mb-4">Metadata</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Authors</dt>
                  <dd>{paper.authors.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Pages</dt>
                  <dd>{paper.pageCount}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Source</dt>
                  <dd className="capitalize">{paper.source}</dd>
                </div>
                {paper.arxivId && (
                  <div>
                    <dt className="text-[var(--color-text-secondary)]">arXiv ID</dt>
                    <dd>{paper.arxivId}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Uploaded</dt>
                  <dd>{new Date(paper.uploadedAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
