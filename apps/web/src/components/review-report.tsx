import { Card } from "@/components/ui/card";

interface ReportData {
  overallScore: number;
  confidence: number;
  summary: string;
  strengths: Array<{ point: string; detail: string }>;
  weaknesses: Array<{ point: string; detail: string }>;
  questions: string[];
  suggestions: string[];
}

interface Props {
  report: ReportData;
}

export function ReviewReport({ report }: Props) {
  return (
    <div className="space-y-6">
      {/* Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Overall Score
          </h3>
          <p className="text-4xl font-bold mt-2">
            {report.overallScore}
            <span className="text-lg text-[var(--color-text-secondary)]">/10</span>
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Confidence
          </h3>
          <p className="text-4xl font-bold mt-2">
            {report.confidence}
            <span className="text-lg text-[var(--color-text-secondary)]">/5</span>
          </p>
        </Card>
      </div>

      {/* Summary */}
      <Card>
        <h2 className="text-lg font-semibold mb-3">Summary</h2>
        <p className="text-[var(--color-text-secondary)] leading-relaxed">
          {report.summary || "No summary available."}
        </p>
      </Card>

      {/* Strengths */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-success)]">
          Strengths
        </h2>
        {report.strengths.length > 0 ? (
          <div className="space-y-4">
            {report.strengths.map((s, i) => (
              <div key={i} className="border-l-2 border-[var(--color-success)] pl-4">
                <h3 className="font-medium">{s.point}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--color-text-secondary)]">None identified.</p>
        )}
      </Card>

      {/* Weaknesses */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-danger)]">
          Weaknesses
        </h2>
        {report.weaknesses.length > 0 ? (
          <div className="space-y-4">
            {report.weaknesses.map((w, i) => (
              <div key={i} className="border-l-2 border-[var(--color-danger)] pl-4">
                <h3 className="font-medium">{w.point}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {w.detail}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--color-text-secondary)]">None identified.</p>
        )}
      </Card>

      {/* Questions */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Questions for Authors</h2>
        {report.questions.length > 0 ? (
          <ul className="list-disc list-inside space-y-2 text-[var(--color-text-secondary)]">
            {report.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--color-text-secondary)]">No questions.</p>
        )}
      </Card>

      {/* Suggestions */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Suggestions</h2>
        {report.suggestions.length > 0 ? (
          <ul className="list-disc list-inside space-y-2 text-[var(--color-text-secondary)]">
            {report.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--color-text-secondary)]">No suggestions.</p>
        )}
      </Card>
    </div>
  );
}
