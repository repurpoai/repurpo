"use client";

import { Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExportButtonProps = {
  text: string;
  filename: string;
  disabled?: boolean;
};

export function ExportButton({
  text,
  filename,
  disabled = false
}: ExportButtonProps) {
  function handleExport() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  if (disabled) {
    return (
      <Button type="button" variant="outline" size="sm" disabled className="opacity-70">
        <Lock className="h-4 w-4" />
        Pro export
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4" />
      Export .txt
    </Button>
  );
}