"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  name?: string;
  action: string;
  onTokenChange?: (token: string) => void;
  resetSignal?: number;
};

export function TurnstileWidget({
  name = "captchaToken",
  action,
  onTokenChange,
  resetSignal = 0
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const stableAction = useMemo(() => action, [action]);

  const renderWidget = useCallback(() => {
    if (!siteKey || !widgetContainerRef.current || !window.turnstile || widgetIdRef.current) {
      return false;
    }

    try {
      widgetContainerRef.current.innerHTML = "";
      widgetIdRef.current = window.turnstile.render(widgetContainerRef.current, {
        sitekey: siteKey,
        action: stableAction,
        theme: "light",
        callback: (nextToken: string) => {
          setToken(nextToken);
          onTokenChange?.(nextToken);
          setRenderError(null);
          setIsRendering(false);
        },
        "expired-callback": () => {
          setToken("");
          onTokenChange?.("");
        },
        "error-callback": () => {
          setToken("");
          onTokenChange?.("");
          setRenderError("Security check failed to load. Refresh and try again.");
          setIsRendering(false);
        }
      });

      setRenderError(null);
      setIsRendering(false);
      return true;
    } catch {
      setRenderError("Security check failed to load. Refresh and try again.");
      setIsRendering(false);
      return false;
    }
  }, [onTokenChange, siteKey, stableAction]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.turnstile) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!siteKey || !scriptReady) {
      return;
    }

    if (renderWidget()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!renderWidget()) {
        setRenderError("Security check failed to load. Refresh and try again.");
        setIsRendering(false);
      }
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [renderWidget, scriptReady, siteKey]);

  useEffect(() => {
    if (!widgetIdRef.current || !window.turnstile) {
      return;
    }

    window.turnstile.reset(widgetIdRef.current);
    setToken("");
    onTokenChange?.("");
    setRenderError(null);
    setIsRendering(false);
  }, [onTokenChange, resetSignal]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  if (!siteKey) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Security check is not configured yet. Add <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          setScriptReady(true);
          setRenderError(null);
        }}
        onError={() => {
          setRenderError("Security check failed to load. Refresh and try again.");
          setIsRendering(false);
        }}
      />
      <div ref={widgetContainerRef} className="min-h-[66px]" />
      {isRendering && !renderError ? (
        <p className="text-sm text-slate-500">Loading security check…</p>
      ) : null}
      <input type="hidden" name={name} value={token} readOnly />
      {renderError ? <p className="text-sm text-red-600">{renderError}</p> : null}
    </div>
  );
}
