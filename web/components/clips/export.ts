/**
 * Hands a JSON file to the user. Phones get the share sheet (Save to Files, AirDrop,
 * Drive…), which iOS Safari needs since it ignores `<a download>` for JSON.
 * Elsewhere it falls back to a normal download.
 */
export async function shareOrDownload(fileName: string, data: unknown): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const file = new File([blob], fileName, { type: "application/json" });

  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
