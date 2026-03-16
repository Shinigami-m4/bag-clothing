"use client";

import { useEffect, useMemo, useState } from "react";
import Portal from "./Portal";

type GateWindow = Window & {
  showGate?: () => void;
  resetGate?: () => void;
};

export default function EntryGateModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const DEV_EMAIL = useMemo(() => {
    return (process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL || "").trim().toLowerCase();
  }, []);

  const isDevEmail = useMemo(() => {
    return DEV_EMAIL.length > 0 && email.trim().toLowerCase() === DEV_EMAIL;
  }, [email, DEV_EMAIL]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.has("resetGate")) {
      window.localStorage.removeItem("bag_newsletter_dismissed");
      setOpen(true);
      return;
    }

    if (params.has("gate")) {
      setOpen(true);
      return;
    }

    const dismissed = window.localStorage.getItem("bag_newsletter_dismissed");
    if (!dismissed) setOpen(true);
  }, []);

  useEffect(() => {
    const gateWindow = window as GateWindow;

    gateWindow.showGate = () => setOpen(true);
    gateWindow.resetGate = () => {
      window.localStorage.removeItem("bag_newsletter_dismissed");
      setOpen(true);
    };

    return () => {
      delete gateWindow.showGate;
      delete gateWindow.resetGate;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);

    const t = window.setTimeout(() => {
      const modalExists = document.querySelector('[data-bag-entry-gate="1"]');
      if (!modalExists) {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
        setOpen(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  if (!open) return null;

  function dismiss() {
    window.localStorage.setItem("bag_newsletter_dismissed", "1");
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

      window.localStorage.setItem("bag_newsletter_dismissed", "1");
      window.location.href = "/admin";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMsg(message);
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = isDevEmail ? submitAdminLogin : submitNewsletter;

  return (
    <Portal>
      <div className="fixed inset-0 z-[2147483647]" data-bag-entry-gate="1">
        <div className="absolute inset-0 bg-black/75" onClick={dismiss} />

        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            className="w-[min(92vw,560px)] rounded-sm bg-[#f4f4f4] text-black"
           
            style={{ padding: "30px 34px 28px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-4xl uppercase tracking-[0.05em]">Join The Drop List</h2>
                <p className="mt-2 text-sm">Get notified on releases, restocks, and limited artist drops.</p>
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

            {!DEV_EMAIL && (
              <p className="mb-3 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs text-red-800">
                Missing <b>NEXT_PUBLIC_DEV_ADMIN_EMAIL</b> in <b>.env.local</b>
              </p>
            )}

            <form onSubmit={onSubmit} className="space-y-3">
              <div style={{ marginBottom: "18px" }}>
                <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-black/80">Email</label>
                <input
                  className="w-full rounded-lg border-2 border-black bg-white px-4 py-3 text-sm text-black outline-none placeholder:text-black/50"
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {isDevEmail && (
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-black/80">
                    Admin Password
                  </label>
                  <input
                    className="w-full rounded-lg border-2 border-black bg-white px-4 py-3 text-sm text-black outline-none placeholder:text-black/50"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <button
                disabled={loading}
                className="homeBtn w-full justify-center disabled:opacity-60"
              >
                {loading ? "Please wait..." : isDevEmail ? "Admin Login" : "GOONED OUT"}
              </button>

              <button
                type="button"
                onClick={dismiss}
                className="homeBtn ghost w-full justify-center"
              >
                NO, THANK YOU
              </button>
            </form>

            {msg && <p className="mt-4 text-sm text-black">{msg}</p>}

            <p className="mt-4 text-xs text-black/70">We respect your inbox. Unsubscribe anytime.</p>
          </div>
        </div>
      </div>
    </Portal>
  );
}










