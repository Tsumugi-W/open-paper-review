import { Nav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MembersPage() {
  // TODO: Fetch team members from DB
  const members: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  }> = [];

  return (
    <>
      <Nav />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Team Members</h1>
          <Button>Invite Member</Button>
        </div>

        {members.length === 0 ? (
          <Card>
            <p className="text-[var(--color-text-secondary)] text-center py-12">
              No team members yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <Card key={member.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{member.name}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-1 bg-[var(--color-bg-secondary)] rounded text-xs font-medium capitalize">
                      {member.role}
                    </span>
                    <Button variant="danger">Remove</Button>
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
