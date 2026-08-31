"use client";

import { useFormStatus } from "react-dom";

import { LoaderIcon } from "@/components/icons";

import { Button } from "./ui/button";

export function SubmitButton({
  children,
  isSuccessful,
  disabled = false,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const isDisabled = pending || isSuccessful || disabled;

  return (
    <Button
      aria-disabled={isDisabled}
      className="relative"
      disabled={isDisabled}
      type={isDisabled ? "button" : "submit"}
    >
      {children}

      {isDisabled && (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {isDisabled ? "Loading" : "Submit form"}
      </output>
    </Button>
  );
}
