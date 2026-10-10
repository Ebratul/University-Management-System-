"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useApiMutation } from "@/hooks/use-api-mutation";
import { authApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { homeForRole } from "@/lib/auth/roles";
import { publicEnv } from "@/lib/env";

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
};

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript(): Promise<GoogleIdentity> {
  const existing = (window as unknown as { google?: GoogleIdentity }).google;
  if (existing?.accounts) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`) ?? document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve((window as unknown as { google: GoogleIdentity }).google);
    script.onerror = () => reject(new Error("Google sign-in could not be loaded."));
    if (!script.isConnected) document.head.append(script);
  });
}

/**
 * "Continue with Google". Google returns an ID token; the API verifies it and
 * only admits users registered for the university that owns their email domain.
 * Renders nothing when NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.
 */
export function GoogleSignIn({ next }: { next: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const signIn = useApiMutation({
    mutationFn: authApi.google,
    notifyError: false,
    onSuccess: (session) => {
      queryClient.clear();
      router.replace(next ?? homeForRole(session.role));
      router.refresh();
    },
  });
  const { mutate } = signIn;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogleScript()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            setError(null);
            mutate(credential, { onError: (e) => setError(toApiError(e).message) });
          },
        });
        google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", text: "continue_with", width: 320 });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, mutate]);

  if (!clientId) return null;

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground flex items-center gap-3 text-xs uppercase">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
      {error ? (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          {error}
        </div>
      ) : null}
      <div ref={buttonRef} className="flex justify-center" aria-busy={signIn.isPending} />
    </div>
  );
}
