import { toast as sonnerToast } from "sonner";

export function toast({
  type,
  description,
}: {
  type: "success" | "error" | "info";
  description: string;
}) {
  const id = `${type}:${description}`;
  if (type === "error") sonnerToast.error(description, { id });
  else if (type === "success") sonnerToast.success(description, { id });
  else sonnerToast(description, { id });
}
