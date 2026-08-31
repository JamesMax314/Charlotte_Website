import { redirect } from "next/navigation";
import { Container } from "@/components/container";
import { Mark } from "@/components/mark";
import { hasValidSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await hasValidSession()) redirect("/admin");

  return (
    <Container className="flex min-h-[70dvh] max-w-md flex-col justify-center">
      <Mark className="text-ink h-14 w-14" />
      <h1 className="font-display mt-5 text-3xl tracking-tight">Studio</h1>
      <p className="text-graphite mt-2 text-sm">Enter your passphrase to manage the gallery.</p>
      <LoginForm />
    </Container>
  );
}
