"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useNow } from "@/features/quiz/use-clock";
import { toApiError } from "@/lib/api/errors";

const COOLDOWN_SECONDS = 60;

/**
 * "Resend code" with the same one-minute cooldown the server applies. Start it
 * already counting down when a code was only just emailed.
 */
export function ResendCodeButton({
  onResend,
  startCoolingDown,
}: {
  onResend: () => Promise<unknown>;
  startCoolingDown: boolean;
}) {
  const [readyAt, setReadyAt] = useState(() => (startCoolingDown ? Date.now() + COOLDOWN_SECONDS * 1000 : 0));
  const [busy, setBusy] = useState(false);
  const now = useNow(1000);
  const secondsLeft = Math.max(0, Math.ceil((readyAt - now) / 1000));

  async function resend() {
    setBusy(true);
    try {
      await onResend();
      setReadyAt(Date.now() + COOLDOWN_SECONDS * 1000);
      toast.success("If that address can receive a code, a new one is on its way.");
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={busy || secondsLeft > 0} onClick={() => void resend()}>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
    </Button>
  );
}
