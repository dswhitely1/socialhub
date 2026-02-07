"use client";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground mt-2">
            Get started with SocialHub
          </p>
        </div>
        <div className="space-y-3">
          <button className="w-full rounded-lg border border-border px-4 py-3 hover:bg-muted transition-colors">
            Sign up with Google
          </button>
          <button className="w-full rounded-lg border border-border px-4 py-3 hover:bg-muted transition-colors">
            Sign up with GitHub
          </button>
        </div>
      </div>
    </main>
  );
}
