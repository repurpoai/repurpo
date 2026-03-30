"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [renderError, setRenderError] = useState<string | null>(null);
  const stableAction = useMemo(() => action, [action]);

  useEffect(() => {
    if (!siteKey || !scriptReady || !widgetContainerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(widgetContainerRef.current, {
      sitekey: siteKey,
      action: stableAction,
      theme: "light",
      callback: (nextToken: string) => {
        setToken(nextToken);
        onTokenChange?.(nextToken);
        setRenderError(null);
      },
      "expired-callback": () => {
        setToken("");
        onTokenChange?.("");
      },
      "error-callback": () => {
        setToken("");
        onTokenChange?.("");
        setRenderError("Security check failed to load. Refresh and try again.");
      }
    });
  }, [onTokenChange, scriptReady, siteKey, stableAction]);

  useEffect(() => {
    if (!widgetIdRef.current || !window.turnstile) {
      return;
    }

    window.turnstile.reset(widgetIdRef.current);
    setToken("");
    onTokenChange?.("");
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
        onLoad={() => setScriptReady(true)}
      />
      <div ref={widgetContainerRef} />
      <input type="hidden" name={name} value={token} readOnly />
      {renderError ? <p className="text-sm text-red-600">{renderError}</p> : null}
    </div>
  );
}
