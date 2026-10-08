"use client";

import { useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Camera, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { useSession } from "@/components/auth/session-provider";
import { FormAlert } from "@/components/forms/form-alert";
import { TextInputField } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { getDisplayName } from "@/lib/auth/user";
import { summariseApiError } from "@/lib/forms/server-errors";
import { emptyToUndefined } from "@/lib/validations/admin";
import type { CurrentUser } from "@/types/entities";

const profileSchema = z.object({
  name: z.string().trim().min(3, { error: "Name must be at least 3 characters." }).max(100),
  phone: z.string().trim().refine((v) => v === "" || (v.length >= 6 && v.length <= 20), { error: "Phone must be 6 to 20 characters." }),
  dateOfBirth: z.string(),
});

const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function ProfileForm() {
  const user = useSession();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const profile = user.student ?? user.faculty ?? user.admin;
  const isStudent = user.role === "STUDENT";

  const save = useApiMutation<CurrentUser, { name: string; phone?: string; dateOfBirth?: string }>({
    mutationFn: (body) => apiRequest<CurrentUser>("/users/me", { method: "PATCH", body }),
    notifyError: false,
    successMessage: "Profile saved.",
    invalidate: [queryKeys.me],
  });

  const uploadAvatar = useApiMutation<CurrentUser, File>({
    mutationFn: (file) => {
      const body = new FormData();
      body.append("profileImage", file);
      return apiRequest<CurrentUser>("/users/profile-image", { method: "PATCH", body });
    },
    successMessage: "Photo updated.",
    invalidate: [queryKeys.me],
    onSuccess: () => {
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const form = useForm({
    defaultValues: {
      name: profile?.name ?? getDisplayName(user),
      phone: profile?.phone ?? "",
      dateOfBirth: user.student?.dateOfBirth ? user.student.dateOfBirth.slice(0, 10) : "",
    },
    validators: { onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await save.mutateAsync({
          name: value.name,
          phone: emptyToUndefined(value.phone),
          ...(value.dateOfBirth ? { dateOfBirth: value.dateOfBirth } : {}),
        });
      } catch (error) {
        setServerError(summariseApiError(toApiError(error)));
      }
    },
  });

  function onFileChosen(file: File | undefined) {
    setAvatarError(null);
    if (!file) return;
    if (!ACCEPTED_IMAGES.includes(file.type)) {
      setAvatarError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAvatarError("The image must be 2 MB or smaller.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    uploadAvatar.mutate(file, {
      onError: (error) => {
        setAvatarError(toApiError(error).message);
        setPreview(null);
      },
    });
  }

  const name = getDisplayName(user);
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Account" title="Profile" description="Keep your contact details up to date. Your student ID and login email are managed by the university." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photo</CardTitle>
            <CardDescription>JPEG, PNG or WebP, up to 2 MB.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar className="size-28">
              <AvatarImage src={preview ?? (user.imageUrl || undefined)} alt={`Profile photo of ${name}`} />
              <AvatarFallback className="bg-brand-gradient text-2xl font-semibold text-white">{initials}</AvatarFallback>
            </Avatar>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a profile photo" onChange={(event) => onFileChosen(event.target.files?.[0])} />
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploadAvatar.isPending}>
              {uploadAvatar.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
              {uploadAvatar.isPending ? "Uploading…" : "Change photo"}
            </Button>
            {avatarError ? <p role="alert" className="text-destructive text-sm">{avatarError}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
            <CardDescription>{user.student ? `Registration no. ${user.student.registrationNumber} · Student ID ${user.student.studentId}` : user.faculty ? `Faculty ID ${user.faculty.facultyId}` : "Account details"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form noValidate className="space-y-5" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
              {serverError ? <FormAlert message={serverError.message} details={serverError.details} /> : null}
              <form.Field name="name">{(field) => <TextInputField field={field} label="Full name" autoComplete="name" />}</form.Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <form.Field name="phone">{(field) => <TextInputField field={field} label="Phone" type="tel" autoComplete="tel" />}</form.Field>
                {isStudent ? (
                  <form.Field name="dateOfBirth">{(field) => <TextInputField field={field} label="Date of birth" type="date" />}</form.Field>
                ) : null}
              </div>
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
                {([canSubmit, isSubmitting]) => (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
                      {isSubmitting ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                )}
              </form.Subscribe>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
