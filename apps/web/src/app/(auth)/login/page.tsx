import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

async function loginAction(formData: FormData) {
  "use server";

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return;
  }

  // TODO: Validate credentials against DB
  // const user = await verifyCredentials(email, password);
  // await createSession(user.id);
  redirect("/");
}

export default async function LoginPage() {
  const session = await validateSession();
  if (session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)] w-full">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">OpenPaperReview</h1>
        <p className="text-[var(--color-text-secondary)] text-center mb-8">
          Sign in to your account
        </p>

        <form action={loginAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
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
              placeholder="Enter your password"
              required
            />
          </div>

          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  );
}
