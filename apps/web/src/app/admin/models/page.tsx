import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ModelsPage() {
  // TODO: Fetch model profiles from DB
  const models: Array<{
    id: string;
    name: string;
    provider: string;
    model: string;
    isDefault: boolean;
  }> = [];

  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Model Profiles</h1>
          <Button>Add Model</Button>
        </div>

        {models.length === 0 ? (
          <Card>
            <p className="text-[var(--color-text-secondary)] text-center py-12">
              No model profiles configured yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {models.map((model) => (
              <Card key={model.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">
                      {model.name}
                      {model.isDefault && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                          Default
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {model.provider} / {model.model}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary">Edit</Button>
                    <Button variant="danger">Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
