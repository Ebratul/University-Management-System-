"use client";

import { useRef, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { materialApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { formatBytes, formatDate } from "@/lib/format";
import type { CourseMaterial } from "@/types/entities";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function MaterialsTab({ offeringId, isStaff }: { offeringId: string; isStaff: boolean }) {
  const materials = useApiQuery({
    queryKey: queryKeys.course.materials(offeringId),
    queryFn: () => materialApi.list(offeringId),
  });
  const [toDelete, setToDelete] = useState<CourseMaterial | null>(null);

  const remove = useApiMutation({
    mutationFn: (material: CourseMaterial) => materialApi.remove(offeringId, material.id),
    successMessage: "Material deleted.",
    invalidate: [queryKeys.course.materials(offeringId)],
    onSuccess: () => setToDelete(null),
  });

  return (
    <div className="space-y-6">
      {isStaff ? <UploadCard offeringId={offeringId} /> : null}

      {materials.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : materials.isError ? (
        <EmptyState
          icon={FileText}
          title="Could not load materials"
          description={materials.error.message}
          action={
            <Button variant="outline" onClick={() => void materials.refetch()}>
              Try again
            </Button>
          }
        />
      ) : materials.data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No materials yet"
          description={isStaff ? "Upload a PDF above and every enrolled student will see it here." : "Your teacher has not shared any material yet."}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {materials.data.map((material) => (
            <li key={material.id}>
              <MaterialCard material={material} offeringId={offeringId} isStaff={isStaff} onDelete={() => setToDelete(material)} />
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this material?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.title}” will be removed for every student. Quizzes already made from it keep their questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (toDelete) remove.mutate(toDelete);
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadCard({ offeringId }: { offeringId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  const upload = useApiMutation({
    mutationFn: ({ file: f, title: t }: { file: File; title: string }) => materialApi.upload(offeringId, f, t.trim() || undefined),
    successMessage: "PDF uploaded. Students can see it now.",
    invalidate: [queryKeys.course.materials(offeringId)],
    onSuccess: () => {
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  function choose(next: File | null) {
    setFileError(null);
    if (next && next.type !== "application/pdf") {
      setFileError("Only PDF files can be uploaded.");
      setFile(null);
      return;
    }
    if (next && next.size > MAX_PDF_BYTES) {
      setFileError("The PDF must be 10 MB or smaller.");
      setFile(null);
      return;
    }
    setFile(next);
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Upload a PDF</h2>
          <p className="text-muted-foreground text-sm">Visible only to you and the students enrolled in this course.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="material-file">PDF file</Label>
            <Input
              ref={inputRef}
              id="material-file"
              type="file"
              accept="application/pdf"
              aria-invalid={fileError !== null}
              aria-describedby={fileError ? "material-file-error" : undefined}
              onChange={(event) => choose(event.target.files?.[0] ?? null)}
              className="h-10 cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material-title">Title (optional)</Label>
            <Input id="material-title" value={title} maxLength={150} placeholder="Defaults to the file name" onChange={(event) => setTitle(event.target.value)} className="h-10" />
          </div>
          <Button
            disabled={!file || upload.isPending}
            onClick={() => file && upload.mutate({ file, title })}
            className="bg-brand-gradient h-10 text-white hover:opacity-90"
          >
            {upload.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="size-4" aria-hidden="true" /> Upload
              </>
            )}
          </Button>
        </div>
        {fileError ? (
          <p id="material-file-error" role="alert" className="text-destructive text-sm">
            {fileError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MaterialCard({
  material,
  offeringId,
  isStaff,
  onDelete,
}: {
  material: CourseMaterial;
  offeringId: string;
  isStaff: boolean;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState<"view" | "download" | null>(null);

  // The link is signed for a few minutes and only issued after the server has
  // checked this person belongs to the course, so it is fetched on every click.
  async function open(mode: "view" | "download") {
    setBusy(mode);
    // Opened synchronously: browsers block a window opened after an await.
    const popup = mode === "view" ? window.open("", "_blank") : null;
    try {
      const { url } = await materialApi.link(offeringId, material.id);
      if (popup) {
        popup.opener = null;
        popup.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (error) {
      popup?.close();
      toast.error(error instanceof Error ? error.message : "Could not open the file.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="group h-full transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="bg-brand-rose/12 text-brand-rose flex size-11 shrink-0 items-center justify-center rounded-xl">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold" title={material.title}>
              {material.title}
            </h3>
            <p className="text-muted-foreground truncate text-xs" title={material.fileName}>
              {material.fileName}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Uploaded {formatDate(material.createdAt)} · {formatBytes(material.fileSize)}
            </p>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void open("view")}>
            {busy === "view" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ExternalLink className="size-4" aria-hidden="true" />}
            View
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void open("download")}>
            {busy === "download" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
            Download
          </Button>
          {isStaff ? (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto" onClick={onDelete} aria-label={`Delete ${material.title}`}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
