"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Edit, Users, BookOpen, Trophy, Loader2 } from "lucide-react";
import { getDifficultyBg } from "@/lib/utils";

interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  tags: { name: string }[];
  _count?: { submissions: number };
}

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"problems" | "users" | "contests">("problems");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "", slug: "", description: "", difficulty: "easy",
    constraints: "", hints: "", starterCode: "", tags: "",
  });

  useEffect(() => {
    if (activeTab === "problems") fetchProblems();
    else if (activeTab === "users") fetchUsers();
    else setLoading(false);
  }, [activeTab]);

  async function fetchProblems() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/problems");
      const data = await res.json();
      setProblems(data.problems || []);
    } catch { setProblems([]); }
    finally { setLoading(false); }
  }

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }

  async function handleCreateProblem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ title: "", slug: "", description: "", difficulty: "easy", constraints: "", hints: "", starterCode: "", tags: "" });
        fetchProblems();
      }
    } catch { /* ignore */ }
  }

  async function handleDeleteProblem(id: string) {
    if (!confirm("Delete this problem?")) return;
    await fetch(`/api/admin/problems/${id}`, { method: "DELETE" });
    fetchProblems();
  }

  if (user && user.role !== "admin") {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Access denied. Admin only.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground mt-1">Manage problems, users, and contests</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b mb-6">
            {[
              { key: "problems", label: "Problems", icon: BookOpen },
              { key: "users", label: "Users", icon: Users },
              { key: "contests", label: "Contests", icon: Trophy },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeTab === "problems" ? (
            <div>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setShowForm(!showForm)} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Problem
                </Button>
              </div>

              {showForm && (
                <Card className="mb-6">
                  <CardHeader><CardTitle className="text-lg">New Problem</CardTitle></CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateProblem} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input placeholder="Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-")})} required />
                      <Input placeholder="Slug" value={formData.slug} onChange={(e) => setFormData({...formData, slug: e.target.value})} required />
                      <select value={formData.difficulty} onChange={(e) => setFormData({...formData, difficulty: e.target.value})} className="border rounded-md px-3 py-2 bg-background text-sm">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      <Input placeholder="Tags (comma separated)" value={formData.tags} onChange={(e) => setFormData({...formData, tags: e.target.value})} />
                      <textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="border rounded-md px-3 py-2 bg-background text-sm md:col-span-2 min-h-[100px]" required />
                      <Input placeholder="Constraints" value={formData.constraints} onChange={(e) => setFormData({...formData, constraints: e.target.value})} />
                      <Input placeholder="Hints" value={formData.hints} onChange={(e) => setFormData({...formData, hints: e.target.value})} />
                      <div className="md:col-span-2 flex gap-2">
                        <Button type="submit" size="sm">Create</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium">Title</th>
                      <th className="text-left px-4 py-3 text-sm font-medium hidden md:table-cell">Tags</th>
                      <th className="text-left px-4 py-3 text-sm font-medium">Difficulty</th>
                      <th className="text-left px-4 py-3 text-sm font-medium">Submissions</th>
                      <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {problems.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{p.title}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex gap-1">{p.tags.slice(0, 2).map(t => <Badge key={t.name} variant="secondary" className="text-xs">{t.name}</Badge>)}</div>
                        </td>
                        <td className="px-4 py-3"><Badge className={getDifficultyBg(p.difficulty)}>{p.difficulty}</Badge></td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{p._count?.submissions || 0}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteProblem(p.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "users" ? (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium">Username</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Role</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{u.username}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3"><Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Contest management coming soon</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
