// eslint-disable-next-line no-control-regex -- unmodified CSI cursor keys
const UNMODIFIED_CURSOR_KEY = /^\x1b\[([ABCDHF])$/

// Match xterm's key encoder: DECCKM sends unmodified arrows, Home and End as SS3.
export function applyTerminalCursorKeyMode(
  bytes: string,
  applicationCursorKeysMode: boolean | undefined
): string {
  if (!applicationCursorKeysMode) {
    return bytes
  }
  const match = UNMODIFIED_CURSOR_KEY.exec(bytes)
  return match ? `\x1bO${match[1]}` : bytes
}
