"use client";

import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PaperUpload } from "@/components/paper-upload";

export default function UploadPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">Upload Paper</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Upload PDF</h2>
            <PaperUpload />
          </Card>

          <Card>
            <h2 className="text-lg font-semibold mb-4">Import from arXiv</h2>
            <form
              action="/api/v1/papers/arxiv"
              method="POST"
              className="space-y-4"
            >
              <div>
                <label htmlFor="arxiv-id" className="block text-sm font-medium mb-1">
                  arXiv ID
                </label>
                <Input
                  id="arxiv-id"
                  name="arxivId"
                  type="text"
                  placeholder="e.g. 2301.07041"
                />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Enter an arXiv paper ID to automatically download and import the paper.
              </p>
              <Button type="submit">Import from arXiv</Button>
            </form>
          </Card>
        </div>
      </main>
    </>
  );
}
