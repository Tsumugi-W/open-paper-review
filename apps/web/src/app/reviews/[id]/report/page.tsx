import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { ReviewReport } from "@/components/review-report";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;

  // TODO: Fetch review report from DB
  const report = {
    id,
    paperTitle: "Sample Paper",
    venue: "NeurIPS",
    overallScore: 6,
    confidence: 4,
    summary: "This paper presents an interesting approach to...",
    strengths: [
      { point: "Novel methodology", detail: "The proposed approach..." },
      { point: "Thorough evaluation", detail: "Comprehensive experiments..." },
    ],
    weaknesses: [
      { point: "Limited analysis", detail: "The paper could benefit from..." },
      { point: "Missing baselines", detail: "Some important baselines..." },
    ],
    questions: [
      "How does the method scale to larger datasets?",
      "What is the computational overhead?",
    ],
    suggestions: [
      "Add ablation study for component X",
      "Include comparison with method Y",
    ],
  };

  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href={`/reviews/${id}`}
              className="text-sm text-[var(--color-text-secondary)] hover:underline mb-2 block"
            >
              &larr; Back to Review
            </Link>
            <h1 className="text-3xl font-bold">Review Report</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              {report.paperTitle} - {report.venue}
            </p>
          </div>
          <div className="flex gap-2">
            <a href={`/api/v1/reviews/${id}/export?format=markdown`}>
              <Button variant="secondary">Export Markdown</Button>
            </a>
            <a href={`/api/v1/reviews/${id}/export?format=pdf`}>
              <Button variant="secondary">Export PDF</Button>
            </a>
          </div>
        </div>

        <ReviewReport report={report} />
      </main>
    </>
  );
}
