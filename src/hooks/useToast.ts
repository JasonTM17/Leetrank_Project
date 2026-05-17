"use client";

import { create } from "zustand";
import { useEffect } from "react";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id, variant: toast.variant ?? "default", duration: toast.duration ?? 4000, title: toast.title, description: toast.description },
      ],
    }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

// Convenience helpers — call from anywhere, including outside React.
export const toast = {
  show: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "default" }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "success" }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "error" }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "info" }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "warning" }),
};

export function useAutoDismiss() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), t.duration));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);
}
