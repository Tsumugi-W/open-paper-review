"use client";

import { useSearchParams } from "next/navigation";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewReviewPage() {
  const searchParams = useSearchParams();
  const paperId = searchParams.get("paperId") ?? "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/v1/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paperId: form.get("paperId"),
        venueId: form.get("venueId"),
        language: form.get("language"),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      window.location.href = `/reviews/${data.id}`;
    }
  }

  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">New Review</h1>

        <Card className="max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="paperId" className="block text-sm font-medium mb-1">
                Paper
              </label>
              <Input
                id="paperId"
                name="paperId"
                type="text"
                defaultValue={paperId}
                placeholder="Select or enter paper ID"
                required
              />
            </div>

            <div>
              <label htmlFor="venueId" className="block text-sm font-medium mb-1">
                Venue
              </label>
              <select
                id="venueId"
                name="venueId"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                required
              >
                <option value="">Select a venue...</option>
                <option value="neurips">NeurIPS</option>
                <option value="icml">ICML</option>
                <option value="iclr">ICLR</option>
                <option value="acl">ACL</option>
                <option value="emnlp">EMNLP</option>
                <option value="cvpr">CVPR</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label htmlFor="language" className="block text-sm font-medium mb-1">
                Review Language
              </label>
              <select
                id="language"
                name="language"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="zh">Chinese</option>
              </select>
            </div>

            <Button type="submit" className="w-full">
              Start Review
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
