import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** A person's picture, falling back to their initials when they have none. */
export function PersonAvatar({
  name,
  imageUrl,
  size = "default",
  className,
}: {
  name: string;
  imageUrl?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
      <AvatarFallback className="bg-brand-indigo/12 text-brand-indigo text-xs font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
