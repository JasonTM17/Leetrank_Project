"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    /* eslint-disable react-hooks/set-state-in-effect */
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
    /* eslint-enable react-hooks/set-state-in-effect */
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
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <SettingsIcon className="h-7 w-7 text-primary" /> Settings
            </h1>
            <p className="mt-1 text-muted-foreground">
              Update how you appear on your public profile.
            </p>
          </div>

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
                    Username can&apos;t be changed yet. <Link href={`/users/${user?.username ?? ""}`} className="text-primary hover:underline">View public profile</Link>.
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
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
