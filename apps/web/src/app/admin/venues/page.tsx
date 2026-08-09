import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VenuesPage() {
  // TODO: Fetch venue bundles from DB
  const venues: Array<{
    id: string;
    name: string;
    shortName: string;
    criteriaCount: number;
  }> = [];

  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Venue Bundles</h1>
          <Button>Add Venue</Button>
        </div>

        {venues.length === 0 ? (
          <Card>
            <p className="text-[var(--color-text-secondary)] text-center py-12">
              No venue bundles configured yet.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((venue) => (
              <Card key={venue.id}>
                <h3 className="font-medium">{venue.name}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {venue.shortName} &middot; {venue.criteriaCount} criteria
                </p>
                <div className="flex gap-2 mt-4">
                  <Button variant="secondary">Edit</Button>
                  <Button variant="danger">Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
