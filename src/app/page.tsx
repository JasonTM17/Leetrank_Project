import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Code2, Trophy, Users, Zap, ArrowRight, CheckCircle } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground mb-6">
                <Zap className="h-4 w-4 text-primary" />
                <span>Level up your coding skills</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                Master Algorithms.{" "}
                <span className="text-primary">Ace Interviews.</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Practice coding problems, compete in contests, and track your progress.
                Join thousands of developers sharpening their skills on LeetRank.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="gap-2">
                    Get Started Free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/problems">
                  <Button variant="outline" size="lg">
                    Browse Problems
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: "500+", label: "Problems" },
                { value: "50K+", label: "Submissions" },
                { value: "10K+", label: "Users" },
                { value: "100+", label: "Contests" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Everything you need to succeed</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From beginner to expert, LeetRank provides the tools and challenges to help you grow.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Code2,
                  title: "500+ Problems",
                  description: "Curated problems across all difficulty levels with detailed explanations and multiple solutions.",
                },
                {
                  icon: Trophy,
                  title: "Weekly Contests",
                  description: "Compete with developers worldwide in timed contests. Climb the leaderboard and earn badges.",
                },
                {
                  icon: Users,
                  title: "Community",
                  description: "Learn from others, share solutions, and discuss approaches with a growing community.",
                },
              ].map((feature) => (
                <div key={feature.title} className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow">
                  <feature.icon className="h-10 w-10 text-primary mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 border-t bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Code in your favorite language</h2>
              <p className="text-muted-foreground">Support for popular programming languages</p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {["Python", "JavaScript", "Go", "Ruby", "C++"].map((lang) => (
                <div key={lang} className="flex items-center gap-2 rounded-full border px-5 py-2.5 bg-card">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">{lang}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-8 md:p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to start coding?</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Join LeetRank today and take the first step towards mastering algorithms and data structures.
              </p>
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Create Free Account <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
