"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLanguage } from "@/lib/i18n";

type ConfirmOptions = {
  /** Already-translated title/message, or an i18n key resolved by the caller. */
  message: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type Toast = {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
};

type FeedbackContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, tone?: Toast["tone"]) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const activeConfirm = useRef<PendingConfirm | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const acceptButton = useRef<HTMLButtonElement>(null);
  const confirmId = useId();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(0);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        if (activeConfirm.current) {
          resolve(false);
          return;
        }
        previousFocus.current = document.activeElement instanceof HTMLElement
          ? document.activeElement : null;
        activeConfirm.current = { ...options, resolve };
        setPending(activeConfirm.current);
      }),
    [],
  );

  const resolvePending = useCallback(
    (value: boolean) => {
      const current = activeConfirm.current;
      activeConfirm.current = null;
      setPending(null);
      current?.resolve(value);
    },
    [],
  );

  useEffect(() => {
    if (pending) {
      cancelButton.current?.focus();
    } else {
      previousFocus.current?.focus();
      previousFocus.current = null;
    }
  }, [pending]);

  useEffect(() => () => {
    activeConfirm.current?.resolve(false);
    activeConfirm.current = null;
  }, []);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = (nextToastId.current += 1);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4_000);
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({ confirm, toast }),
    [confirm, toast],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {pending && (
        <div
          className="confirm-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) resolvePending(false);
          }}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${confirmId}-title`}
            aria-describedby={pending.description ? `${confirmId}-description` : undefined}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                resolvePending(false);
              } else if (event.key === "Tab") {
                const first = cancelButton.current;
                const last = acceptButton.current;
                if (event.shiftKey && event.target === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && event.target === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <strong id={`${confirmId}-title`}>{pending.message}</strong>
            {pending.description && <p id={`${confirmId}-description`}>{pending.description}</p>}
            <div className="confirm-actions">
              <button
                className="confirm-cancel"
                type="button"
                ref={cancelButton}
                onClick={() => resolvePending(false)}
              >
                {pending.cancelLabel ?? t("取消")}
              </button>
              <button
                className="confirm-accept"
                data-tone={pending.tone ?? "default"}
                type="button"
                ref={acceptButton}
                onClick={() => resolvePending(true)}
              >
                {pending.confirmLabel ?? t("确认")}
              </button>
            </div>
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((item) => (
            <div className="toast-item" data-tone={item.tone} key={item.id}>
              <span>{item.message}</span>
            </div>
          ))}
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

const fallbackFeedback: FeedbackContextValue = {
  confirm: async (options) =>
    typeof window === "undefined" ? false : window.confirm(options.message),
  toast: () => undefined,
};

export function useFeedback() {
  return useContext(FeedbackContext) ?? fallbackFeedback;
}
