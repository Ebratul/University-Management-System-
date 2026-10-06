"use client";

import { useRef, useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";

import { revalidateWebsiteSettings } from "@/actions/website-settings";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormAlert } from "@/components/forms/form-alert";
import { TextInputField } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandImage } from "@/components/website/brand-image";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { websiteSettingsApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { summariseApiError } from "@/lib/forms/server-errors";
import { websiteSettingsSchema, type WebsiteSettingsInput } from "@/lib/validations/admin";
import { BRANDING_IMAGE_TYPES, BRANDING_MAX_BYTES } from "@/lib/website-settings";
import type { WebsiteSettings } from "@/types/entities";

export function WebsiteSettingsManager() {
  const settings = useApiQuery({
    queryKey: queryKeys.websiteSettings,
    queryFn: websiteSettingsApi.get,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website"
        title="Website management"
        description="Branding for the public website: the university name, tagline, logo and homepage background."
      />

      {settings.isPending ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : settings.isError ? (
        <FormAlert message={settings.error.message} />
      ) : (
        <>
          <IdentityForm settings={settings.data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <AssetCard
              kind="logo"
              title="University logo"
              description="Shown on the splash screen, header and footer. JPG, PNG or WebP, up to 5 MB."
              url={settings.data.logoUrl}
              previewClass="aspect-square max-h-56 bg-white p-4"
              imageClass="size-full object-contain"
              upload={websiteSettingsApi.uploadLogo}
              remove={websiteSettingsApi.removeLogo}
            />
            <AssetCard
              kind="background"
              title="Homepage background"
              description="Large banner image behind the homepage hero. JPG, PNG or WebP, up to 5 MB; landscape works best."
              url={settings.data.homepageBackgroundUrl}
              previewClass="aspect-video"
              imageClass="size-full object-cover"
              upload={websiteSettingsApi.uploadBackground}
              remove={websiteSettingsApi.removeBackground}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Saves, then refreshes both the client cache and the server-rendered public pages. */
function useSettingsMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<WebsiteSettings>,
  successMessage: string,
  notifyError = true,
) {
  return useApiMutation<WebsiteSettings, TVariables>({
    mutationFn,
    successMessage,
    notifyError,
    invalidate: [queryKeys.websiteSettings],
    onSuccess: () => revalidateWebsiteSettings(),
  });
}

function IdentityForm({ settings }: { settings: WebsiteSettings }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);
  const save = useSettingsMutation(websiteSettingsApi.update, "Website settings saved.", false);

  const form = useForm({
    defaultValues: { universityName: settings.universityName, tagline: settings.tagline } as WebsiteSettingsInput,
    validators: { onSubmit: websiteSettingsSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await save.mutateAsync(value);
      } catch (error) {
        setServerError(summariseApiError(toApiError(error)));
      }
    },
  });

  return (
    <SectionCard title="University identity" description="The name and tagline shown in the header, splash screen and hero.">
      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {serverError ? <FormAlert message={serverError.message} details={serverError.details} /> : null}
        <form.Field name="universityName">
          {(field) => <TextInputField field={field} label="University name" maxLength={120} />}
        </form.Field>
        <form.Field name="tagline">
          {(field) => <TextInputField field={field} label="Tagline" maxLength={240} />}
        </form.Field>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty] as const}>
          {([canSubmit, isSubmitting, isDirty]) => (
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting || !isDirty}
                className="bg-brand-gradient text-white hover:opacity-90"
              >
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </SectionCard>
  );
}

type AssetCardProps = {
  kind: "logo" | "background";
  title: string;
  description: string;
  url: string | null;
  previewClass: string;
  imageClass: string;
  upload: (file: File) => Promise<WebsiteSettings>;
  remove: () => Promise<WebsiteSettings>;
};

function AssetCard({ kind, title, description, url, previewClass, imageClass, upload, remove }: AssetCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const label = kind === "logo" ? "logo" : "homepage background";

  const uploadMutation = useSettingsMutation(upload, `Your ${label} was updated.`);
  const removeMutation = useSettingsMutation(() => remove(), `Your ${label} was removed.`);

  function onFileChosen(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
    if (!file) return;

    if (!(BRANDING_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Only JPG, PNG or WebP images are allowed.");
      return;
    }
    if (file.size > BRANDING_MAX_BYTES) {
      toast.error("The image is larger than 5 MB.");
      return;
    }

    // Replacing an existing asset changes the live site, so confirm first.
    if (url) setPendingFile(file);
    else uploadMutation.mutate(file);
  }

  return (
    <SectionCard title={title} description={description}>
      <div className="space-y-4">
        <div className={`bg-muted relative flex w-full items-center justify-center overflow-hidden rounded-xl border ${previewClass}`}>
          <BrandImage
            src={url}
            alt={url ? `Current ${label}` : ""}
            className={imageClass}
            fallback={
              <div className="text-muted-foreground flex flex-col items-center gap-2 p-4 text-center text-sm">
                <ImageIcon className="size-8" aria-hidden="true" />
                {url ? "The current image could not be loaded." : `No ${label} set. The default is shown on the site.`}
              </div>
            }
          />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={BRANDING_IMAGE_TYPES.join(",")}
          className="sr-only"
          aria-label={`Choose ${label} file`}
          tabIndex={-1}
          onChange={(event) => onFileChosen(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}>
            <Upload className="size-4" aria-hidden="true" />
            {uploadMutation.isPending ? "Uploading…" : url ? `Replace ${label}` : `Upload ${label}`}
          </Button>
          {url ? (
            <Button type="button" variant="outline" onClick={() => setConfirmRemove(true)} disabled={removeMutation.isPending}>
              <Trash2 className="text-destructive size-4" aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={pendingFile !== null}
        onOpenChange={(open) => !open && setPendingFile(null)}
        title={`Replace the ${label}?`}
        description={`"${pendingFile?.name ?? "The new image"}" will replace the current ${label} on the public website straight away.`}
        confirmLabel="Replace"
        pending={uploadMutation.isPending}
        onConfirm={() => {
          if (pendingFile) uploadMutation.mutate(pendingFile, { onSettled: () => setPendingFile(null) });
        }}
      />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove the ${label}?`}
        description={`The public website will go back to its default ${label}.`}
        confirmLabel="Remove"
        pending={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate(undefined, { onSettled: () => setConfirmRemove(false) })}
      />
    </SectionCard>
  );
}
