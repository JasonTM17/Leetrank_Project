"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";
import { Loader2, Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user) {
          router.push("/login?from=/dashboard/settings");
          return;
        }
        setUser(data.user);
        setBio(data.user.bio ?? "");
        setAvatar(data.user.avatar ?? "");
      })
      .finally(() => setLoading(false));
  }, [router, setUser]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, avatar }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("Could not save", data.error ?? "Try again later.");
        return;
      }
      const data = await res.json();
      setUser(data.user);
      toast.success("Profile updated");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-2xl w-full px-4 py-12 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden="true" />
          <div className="absolute inset-0 bg-radial-fade" aria-hidden="true" />
          <div className="absolute inset-x-0 -top-16 h-64 bg-gradient-to-b from-primary/15 to-transparent blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
            <Breadcrumb
              className="mb-6"
              items={[
                { label: "Home", href: "/" },
                { label: "Dashboard", href: "/dashboard" },
                { label: "Settings" },
              ]}
            />

            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary backdrop-blur mb-3">
                <SettingsIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-medium">Profile preferences</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                <span className="gradient-text">Settings</span>
              </h1>
              <p className="mt-2 text-muted-foreground text-lg">
                Update how you appear on your public profile.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Username</label>
                  <Input value={user?.username ?? ""} disabled />
                  <p className="text-xs text-muted-foreground">
                    Username can&apos;t be changed yet.{" "}
                    <Link href={`/users/${user?.username ?? ""}`} className="text-primary hover:underline">
                      View public profile
                    </Link>.
                  </p>
                </div>
                <div className="space-y-1">
                  <label htmlFor="bio" className="text-sm font-medium">Bio</label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    placeholder="Tell other users a bit about yourself..."
                    className="w-full bg-background border rounded-md px-3 py-2 text-sm min-h-[100px] resize-y"
                  />
                  <p className="text-xs text-muted-foreground tabular-nums">{bio.length}/500</p>
                </div>
                <div className="space-y-1">
                  <label htmlFor="avatar" className="text-sm font-medium">Avatar URL</label>
                  <Input
                    id="avatar"
                    type="url"
                    placeholder="https://..."
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a URL to an image. Leave empty to remove the current avatar.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Link href="/dashboard/settings/password" className="text-sm text-primary hover:underline">
                    Change password
                  </Link>
                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Code editor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Vim mode, theme, font size, tab width, and word wrap live inside the
                problem editor itself. Open any problem and click the
                <SettingsIcon className="inline-block h-3.5 w-3.5 mx-1 align-text-bottom" aria-hidden="true" />
                gear icon next to the language picker — preferences persist across
                sessions and tabs.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
