import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

async function setupAction(formData: FormData) {
  "use server";

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return;
  }

  // TODO: Check if setup already completed
  // TODO: Create admin user in DB
  // TODO: Create session
  redirect("/");
}

export default async function SetupPage() {
  // TODO: Check if admin already exists, redirect to login if so
  // const hasAdmin = await checkAdminExists();
  // if (hasAdmin) redirect("/login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)] w-full">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">Initial Setup</h1>
        <p className="text-[var(--color-text-secondary)] text-center mb-8">
          Create the first admin account to get started.
        </p>

        <form action={setupAction} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <Input id="name" name="name" type="text" placeholder="Admin Name" required />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Choose a strong password"
              required
              minLength={8}
            />
          </div>

          <Button type="submit" className="w-full">
            Create Admin Account
          </Button>
        </form>
      </Card>
    </div>
  );
}
