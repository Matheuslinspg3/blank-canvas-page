/**
 * Safe clipboard write that gracefully handles "Document is not focused"
 * and other Clipboard API errors by falling back to execCommand.
 * Returns true if the text was copied successfully.
 */
export async function safeWriteClipboard(text: string): Promise<boolean> {
  // Attempt modern Clipboard API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // falls through to legacy fallback
    }
  }

  // Legacy fallback via textarea + execCommand
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
