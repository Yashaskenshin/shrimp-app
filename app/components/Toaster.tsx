"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };
type ToastAPI = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

const ToastCtx = createContext<ToastAPI>({
  success: () => {},
  error: () => {},
  info: () => {},
});

let _id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (message: string, type: ToastType) => {
      const id = ++_id;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const success = useCallback((msg: string) => add(msg, "success"), [add]);
  const error = useCallback((msg: string) => add(msg, "error"), [add]);
  const info = useCallback((msg: string) => add(msg, "info"), [add]);

  return (
    <ToastCtx.Provider value={{ success, error, info }}>
      {children}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2">
          {toasts.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => dismiss(t.id)}
              className={`toast pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg
                ${t.type === "success" ? "bg-emerald-600 text-white" : t.type === "error" ? "bg-rose-600 text-white" : "bg-slate-800 text-white"}`}
            >
              <span aria-hidden>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "i"}</span>
              {t.message}
            </button>
          ))}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
