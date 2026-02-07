import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">SocialHub</h1>
      <p className="text-muted-foreground text-lg">
        Your unified social media hub
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-primary px-6 py-3 text-white hover:bg-primary-hover transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-border px-6 py-3 hover:bg-muted transition-colors"
        >
          Sign Up
        </Link>
      </div>
    </main>
  );
}
