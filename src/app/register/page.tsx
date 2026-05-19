"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Eye, EyeOff, Loader2, Trophy, Users, Zap } from "lucide-react";

interface ApiStats {
  problems: number;
  contests: number;
  users: number;
  accepted: number;
}

const STATIC_STATS = [
  { value: "10K+", label: "Problems" },
  { value: "1K+", label: "Contests" },
  { value: "15", label: "Languages" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ value: string; label: string }[]>(STATIC_STATS);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ApiStats | null) => {
        if (data) {
          setStats([
            { value: data.problems.toLocaleString(), label: "Problems" },
            { value: data.contests.toLocaleString(), label: "Contests" },
            { value: data.users.toLocaleString(), label: "Users" },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/problems");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left pane — form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 md:px-8 lg:px-12">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl mb-8 select-none">
            <span className="h-[14px] w-1 rounded-sm bg-primary shrink-0" aria-hidden="true" />
            <span>
              <span className="text-foreground">Leet</span>
              <span className="gradient-text">Rank</span>
            </span>
          </Link>

          <Card className="border-primary/20 shadow-elevated">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
              <CardDescription>Start your coding journey today — free forever</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div
                    role="alert"
                    className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="reg-username" className="text-sm font-medium">
                    Username
                  </label>
                  <Input
                    id="reg-username"
                    type="text"
                    placeholder="johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    minLength={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reg-email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reg-password" className="text-sm font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground motion-safe:transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground pt-0.5">
                    12+ chars, mixed case + number recommended
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2 hover:shadow-glow motion-safe:transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  )}
                  {loading ? "Creating account…" : "Create account"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-5">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right pane — hero (hidden on mobile) */}
      <div className="hidden md:flex flex-1 relative overflow-hidden bg-card border-l">
        {/* Grid + radial glow */}
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden="true" />
        <div className="absolute inset-0 bg-radial-fade" aria-hidden="true" />
        <div className="absolute inset-x-0 -top-32 h-96 bg-gradient-to-b from-primary/20 to-transparent blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col justify-center px-10 lg:px-16 py-16 max-w-lg mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm text-primary backdrop-blur w-fit mb-8">
            <Zap className="h-4 w-4" aria-hidden="true" />
            <span className="font-medium">Free forever for individuals</span>
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
            Join thousands of developers{" "}
            <span className="gradient-text">levelling up.</span>
          </h2>

          <p className="mt-4 text-muted-foreground leading-relaxed">
            Practice with 10,000+ curated problems, compete in weekly contests, and track your
            progress with a live leaderboard that ranks you globally.
          </p>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-4 text-center"
              >
                <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <blockquote className="mt-10 rounded-xl border border-border/60 bg-card/60 backdrop-blur p-5">
            <p className="text-sm text-muted-foreground leading-relaxed italic">
              &ldquo;The contest system is addictive. I went from struggling with Easy problems to
              consistently solving Mediums in under 20 minutes.&rdquo;
            </p>
            <footer className="mt-3 flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <div className="text-xs font-semibold">Community member</div>
                <div className="text-xs text-muted-foreground">Software Engineer</div>
              </div>
              <Trophy className="h-4 w-4 text-warning ml-auto" aria-hidden="true" />
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
