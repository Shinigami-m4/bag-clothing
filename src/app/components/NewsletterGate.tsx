"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const NEWSLETTER_DISMISSED_KEY = "bag_newsletter_dismissed";

function safeStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function safeStorageRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function openDialogElement(dialog: HTMLDialogElement) {
  try {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
  } catch {}

  dialog.setAttribute("open", "");
}

function closeDialogElement(dialog: HTMLDialogElement) {
  try {
    if (typeof dialog.close === "function") {
      dialog.close();
      return;
    }
  } catch {}

  dialog.removeAttribute("open");
}

export default function NewsletterGate() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"newsletter" | "admin">("newsletter");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/admin");

  const DEV_EMAIL = useMemo(() => {
    return (process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL || "").trim().toLowerCase();
  }, []);
  const maskedAdminEmail = useMemo(() => {
    return "#".repeat(Math.max(DEV_EMAIL.length, 8));
  }, [DEV_EMAIL]);

  const isAdminMode = mode === "admin";

  function normalizeNextPath(value: string | null | undefined) {
    if (!value || !value.startsWith("/admin")) return "/admin";
    return value;
  }

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);

      if (params.has("resetGate")) {
        safeStorageRemove(NEWSLETTER_DISMISSED_KEY);
      }

      const dismissed = safeStorageGet(NEWSLETTER_DISMISSED_KEY);

      if (params.has("gate")) {
        const intent = params.get("intent");
        if (intent === "admin") {
          setMode("admin");
          setEmail(DEV_EMAIL);
          setNextPath(normalizeNextPath(params.get("next")));
        } else {
          setMode("newsletter");
          setEmail("");
          setNextPath("/admin");
        }
        setOpen(true);
        return;
      }

      if (!dismissed) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [DEV_EMAIL]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;

    if (open && !dlg.open) {
      openDialogElement(dlg);
    }

    if (!open && dlg.open) {
      closeDialogElement(dlg);
    }
  }, [open]);

  useEffect(() => {
    function handleOpenGate() {
      setMode("newsletter");
      setMsg(null);
      setEmail("");
      setPassword("");
      setNextPath("/admin");
      setOpen(true);
    }

    function handleOpenAdminLogin(event: Event) {
      const detail = (event as CustomEvent<{ next?: string } | undefined>).detail;
      setMode("admin");
      setMsg(null);
      setEmail(DEV_EMAIL);
      setPassword("");
      setNextPath(normalizeNextPath(detail?.next));
      setOpen(true);
    }

    window.addEventListener("bag:open-newsletter-gate", handleOpenGate);
    window.addEventListener("bag:open-admin-login", handleOpenAdminLogin);
    return () => {
      window.removeEventListener("bag:open-newsletter-gate", handleOpenGate);
      window.removeEventListener("bag:open-admin-login", handleOpenAdminLogin);
    };
  }, [DEV_EMAIL]);

  function dismiss() {
    if (!isAdminMode) {
      safeStorageSet(NEWSLETTER_DISMISSED_KEY, "1");
    }
    setOpen(false);
  }

  async function submitNewsletter(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Newsletter signup failed.");

      setMsg("You're in. Future drop alerts coming soon.");
      setTimeout(() => dismiss(), 900);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMsg(message);
    } finally {
      setLoading(false);
    }
  }

  async function submitAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Invalid admin login.");

      safeStorageSet(NEWSLETTER_DISMISSED_KEY, "1");
      window.location.href = normalizeNextPath(nextPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMsg(message);
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = isAdminMode ? submitAdminLogin : submitNewsletter;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) dismiss();
      }}
      className="m-0 h-screen w-screen max-w-none border-0 bg-transparent p-3 backdrop:bg-black/75 md:p-6"
    >
      <div className="flex min-h-full w-full items-center justify-center">
        <div className="w-full max-w-[560px]">
          <div
            className="max-h-[calc(100dvh-24px)] overflow-y-auto rounded-sm bg-[#f4f4f4] text-black md:max-h-[calc(100dvh-48px)]"
            style={{
              padding:
                "clamp(20px, 4vw, 30px) clamp(18px, 5vw, 34px) clamp(20px, 4vw, 28px)",
            }}
          >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[clamp(1.9rem,8vw,2.25rem)] uppercase tracking-[0.05em]">
                {isAdminMode ? "Admin Sign In" : "Join The Drop List"}
              </h2>
              <p className="mt-2 text-sm">
                {isAdminMode
                  ? "Authorized access only. Enter the admin password to continue."
                  : "Get notified on releases, restocks, and limited artist drops."}
              </p>
            </div>

            <button
              type="button"
              onClick={dismiss}
              className="bg-transparent p-0 text-2xl leading-none text-black/70 transition hover:text-black"
              style={{ appearance: "none", border: "none", boxShadow: "none", outline: "none" }}
              aria-label="Close"
              title="Close"
            >
              x
            </button>
          </div>

          <div className="mb-5 h-px w-full bg-black/25" />

          {!DEV_EMAIL && isAdminMode && (
            <p className="mb-3 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs text-red-800">
              Missing <b>NEXT_PUBLIC_DEV_ADMIN_EMAIL</b> in <b>.env.local</b>
            </p>
          )}

          <form onSubmit={onSubmit} className="space-y-3">
            <div style={{ marginBottom: "18px" }}>
              <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-black/80">
                {isAdminMode ? "Admin Email" : "Email"}
              </label>
              {isAdminMode && DEV_EMAIL.length > 0 ? (
                <>
                  <input
                    className="w-full rounded-lg border-2 border-black bg-white px-4 py-3 text-sm text-black outline-none"
                    type="text"
                    value={maskedAdminEmail}
                    readOnly
                    aria-label="Admin email hidden"
                  />
                  <p className="mt-1 text-xs text-black/65">Admin email hidden for security.</p>
                </>
              ) : (
                <input
                  className="w-full rounded-lg border-2 border-black bg-white px-4 py-3 text-sm text-black outline-none placeholder:text-black/50 focus:bg-white"
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  required
                />
              )}
            </div>

            {isAdminMode && (
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-black/80">
                  Admin Password
                </label>
                <input
                  className="w-full rounded-lg border-2 border-black bg-white px-4 py-3 text-sm text-black outline-none placeholder:text-black/50 focus:bg-white"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  required
                />
              </div>
            )}

            <button
              disabled={loading}
              className="homeBtn w-full justify-center disabled:opacity-60"
            >
              {loading ? "Please wait..." : isAdminMode ? "Admin Login" : "GOONED OUT"}
            </button>

            <button
              type="button"
              onClick={dismiss}
              className="homeBtn ghost w-full justify-center"
            >
              {isAdminMode ? "Cancel" : "NO, THANK YOU"}
            </button>
          </form>

          {msg && <p className="mt-4 text-sm text-black">{msg}</p>}

          {!isAdminMode && (
            <p className="mt-4 text-xs text-black/70">
              We respect your inbox. Unsubscribe anytime.
            </p>
          )}
        </div>
      </div>
      </div>
    </dialog>
  );
}
