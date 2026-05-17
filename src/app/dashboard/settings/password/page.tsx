"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/useToast";
import { Loader2, KeyRound } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("New password and confirmation must match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't change password.");
        return;
      }
      toast.success("Password updated", "Use the new one next time you sign in.");
      router.push("/dashboard/settings");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-md px-4 sm:px-6 py-12">
          <div className="mb-6">
            <Link href="/dashboard/settings" className="text-sm text-muted-foreground hover:text-foreground">
              ← Settings
            </Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" /> Change password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                )}
                <div className="space-y-1">
                  <label htmlFor="current" className="text-sm font-medium">Current password</label>
                  <Input id="current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label htmlFor="new" className="text-sm font-medium">New password</label>
                  <Input id="new" type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNew(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">At least 6 characters.</p>
                </div>
                <div className="space-y-1">
                  <label htmlFor="confirm" className="text-sm font-medium">Confirm new password</label>
                  <Input id="confirm" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Update password
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
