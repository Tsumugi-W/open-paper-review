"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface Stage {
  name: string;
  status: string;
}

interface Props {
  reviewId: string;
  initialStages: Stage[];
}

export function ReviewProgress({ reviewId, initialStages }: Props) {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/v1/reviews/${reviewId}/events`);

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "stage_update") {
          setStages((prev) =>
            prev.map((s) =>
              s.name === data.stage ? { ...s, status: data.status } : s
            )
          );
        } else if (data.type === "log") {
          setLog((prev) => [...prev.slice(-99), data.message]);
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [reviewId]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="text-[var(--color-success)]">&#10003;</span>;
      case "running":
        return <span className="text-[var(--color-primary)] animate-pulse">&#9679;</span>;
      case "failed":
        return <span className="text-[var(--color-danger)]">&#10007;</span>;
      default:
        return <span className="text-[var(--color-text-secondary)]">&#9675;</span>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Progress</h2>
          <span
            className={`text-xs px-2 py-1 rounded ${
              connected
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {connected ? "Live" : "Connecting..."}
          </span>
        </div>

        <div className="space-y-3">
          {stages.map((stage, i) => (
            <div key={stage.name} className="flex items-center gap-3">
              <div className="text-lg w-6 text-center">{statusIcon(stage.status)}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{stage.name}</span>
                  <span className="text-xs text-[var(--color-text-secondary)] capitalize">
                    {stage.status}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <div className="ml-3 mt-1 h-4 border-l border-[var(--color-border)]" />
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {log.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">Log</h2>
          <div className="bg-[var(--color-bg-secondary)] rounded p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
            {log.map((entry, i) => (
              <p key={i} className="text-[var(--color-text-secondary)]">
                {entry}
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
