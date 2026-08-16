"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

/* Minimal toast, no external dependency (module store + portal). */

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

let items: ToastItem[] = [];
let listeners: Array<(t: ToastItem[]) => void> = [];
let seq = 1;

function emit() {
  for (const l of listeners) l(items);
}
function dismiss(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}
function push(kind: ToastKind, message: string) {
  const id = seq++;
  items = [...items, { id, kind, message }];
  emit();
  setTimeout(() => dismiss(id), 4200);
}

export const toast = {
  success: (m: string) => push("success", m),
  error: (m: string) => push("error", m),
  info: (m: string) => push("info", m),
  message: (m: string) => push("info", m),
};

const ICON: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 text-success" />,
  error: <XCircle className="size-4 text-danger" />,
  info: <Info className="size-4 text-info" />,
};

export function Toaster() {
  const [list, setList] = React.useState<ToastItem[]>(items);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    listeners.push(setList);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="admin-scope pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-popover px-3.5 py-3 shadow-[var(--shadow-md)]"
          >
            <span className="mt-0.5 shrink-0">{ICON[t.kind]}</span>
            <p className="flex-1 text-sm text-foreground">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
