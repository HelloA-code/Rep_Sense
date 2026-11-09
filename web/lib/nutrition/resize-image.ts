/**
 * Shrinks a photo in the browser before it's sent anywhere: smaller upload, faster
 * reply, and the original full-resolution photo never leaves the phone.
 * Returns base64 JPEG without the data-URL prefix.
 */
export async function photoToJpegBase64(file: File, maxSide = 1024, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Can't process images in this browser.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}
