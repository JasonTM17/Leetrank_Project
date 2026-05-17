import { describe, it, expect } from "vitest";
import { useToastStore, toast } from "@/hooks/useToast";

describe("useToastStore", () => {
  it("push adds a toast with the given variant + returns its id", () => {
    useToastStore.getState().clear();
    const id = useToastStore.getState().push({ title: "Hi", variant: "success" });
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toBe(id);
    expect(toasts[0].variant).toBe("success");
  });

  it("dismiss removes the toast by id", () => {
    useToastStore.getState().clear();
    const id = useToastStore.getState().push({ title: "Bye", variant: "default" });
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("clear empties the stack", () => {
    useToastStore.getState().clear();
    useToastStore.getState().push({ title: "a", variant: "default" });
    useToastStore.getState().push({ title: "b", variant: "default" });
    useToastStore.getState().clear();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("default duration is 4000ms when not specified", () => {
    useToastStore.getState().clear();
    useToastStore.getState().push({ title: "x", variant: "default" });
    expect(useToastStore.getState().toasts[0].duration).toBe(4000);
  });

  it("custom duration is preserved", () => {
    useToastStore.getState().clear();
    useToastStore.getState().push({ title: "x", variant: "default", duration: 9000 });
    expect(useToastStore.getState().toasts[0].duration).toBe(9000);
  });
});

describe("toast helpers", () => {
  it("each variant helper sets the right variant", () => {
    useToastStore.getState().clear();
    toast.success("ok");
    toast.error("nope");
    toast.info("fyi");
    toast.warning("careful");
    toast.show("plain");
    const variants = useToastStore.getState().toasts.map((t) => t.variant);
    expect(variants).toEqual(["success", "error", "info", "warning", "default"]);
  });
});
