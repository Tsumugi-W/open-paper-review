import Link from "next/link";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PapersPage() {
  // TODO: Fetch papers from DB
  const papers: Array<{
    id: string;
    title: string;
    authors: string[];
    uploadedAt: string;
    pageCount: number;
  }> = [];

  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Papers</h1>
          <Link href="/papers/upload">
            <Button>Upload Paper</Button>
          </Link>
        </div>

        {papers.length === 0 ? (
          <Card>
            <p className="text-[var(--color-text-secondary)] text-center py-12">
              No papers uploaded yet.{" "}
              <Link href="/papers/upload" className="text-[var(--color-primary)] hover:underline">
                Upload your first paper
              </Link>
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {papers.map((paper) => (
              <Link key={paper.id} href={`/papers/${paper.id}`}>
                <Card className="hover:border-[var(--color-primary)] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{paper.title}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {paper.authors.join(", ")}
                      </p>
                    </div>
                    <div className="text-right text-sm text-[var(--color-text-secondary)]">
                      <p>{paper.pageCount} pages</p>
                      <p>{paper.uploadedAt}</p>
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
