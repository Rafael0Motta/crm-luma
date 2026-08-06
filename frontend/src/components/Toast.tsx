import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export type ToastKind = "error" | "success" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  listeners.forEach((listener) => listener(items));
}

export function pushToast(message: string, kind: ToastKind = "info") {
  const id = nextId++;
  items = [...items, { id, message, kind }];
  emit();
  setTimeout(() => {
    items = items.filter((i) => i.id !== id);
    emit();
  }, 5000);
}

export function toastError(message: string) {
  pushToast(message, "error");
}

export function toastSuccess(message: string) {
  pushToast(message, "success");
}

export function ToastContainer() {
  const [visible, setVisible] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setVisible);
    return () => {
      listeners.delete(setVisible);
    };
  }, []);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {visible.map((item) => (
        <div
          key={item.id}
          className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm shadow-lg ${
            item.kind === "error" ? "bg-red-700 text-white" : item.kind === "success" ? "bg-ink-800 text-white" : "bg-ink-950 text-white"
          }`}
        >
          {item.kind === "error" ? (
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          )}
          <p className="flex-1">{item.message}</p>
          <button
            onClick={() => {
              items = items.filter((i) => i.id !== item.id);
              emit();
            }}
            className="flex-shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
