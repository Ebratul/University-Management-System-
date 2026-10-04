"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { authApi } from "@/lib/api/endpoints";

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = useApiMutation({
    mutationFn: authApi.logout,
    notifyError: false,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={logout.isPending}
      onClick={() => logout.mutate()}
      className="text-muted-foreground"
    >
      <LogOut className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Log out</span>
      <span className="sr-only sm:hidden">Log out</span>
    </Button>
  );
}
