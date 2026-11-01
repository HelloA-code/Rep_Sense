/**
 * Hands a file to the user: a Blob as-is (video), anything else as JSON. Phones get
 * the share sheet (Save Video, Save to Files, AirDrop, Drive…), which iOS Safari
 * needs since it ignores `<a download>`. Elsewhere it falls back to a normal download.
 */
export async function shareOrDownload(fileName: string, data: unknown): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = data instanceof Blob ? data : new Blob([JSON.stringify(data)], { type: "application/json" });
  const file = new File([blob], fileName, { type: blob.type });

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
