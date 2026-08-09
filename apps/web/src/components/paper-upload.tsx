"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

export function PaperUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      if (droppedFile.size > 50 * 1024 * 1024) {
        setError("File size exceeds 50MiB limit");
        return;
      }
      setFile(droppedFile);
    } else {
      setError("Only PDF files are accepted");
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 50 * 1024 * 1024) {
        setError("File size exceeds 50MiB limit");
        return;
      }
      setFile(selected);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.pdf$/i, ""));

      const res = await fetch("/api/v1/papers", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      const data = await res.json();
      window.location.href = `/papers/${data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-[var(--color-primary)] bg-blue-50"
            : "border-[var(--color-border)]"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        {file ? (
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MiB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-[var(--color-text-secondary)]">
              Drag and drop a PDF here, or click to browse
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Max 50MiB, 100 pages
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      )}

      <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
        {uploading ? "Uploading..." : "Upload"}
      </Button>
    </div>
  );
}
