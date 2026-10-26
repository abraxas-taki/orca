import type { TerminalDocumentScope } from './document-scope'
import { notify } from './host-notify'
import {
  buildMouseClickInput,
  getMouseTrackingMode,
  isClickMouseTrackingMode
} from './mouse-input-encoding'
import { oscLinkAtViewportPoint } from './osc-link-tap'
import { viewportToCell } from './viewport-cell'
import type { ParsedFileLinkLocation } from '../../../../src/shared/file-link-location'
import {
  findTerminalFileLinksAtBufferPosition,
  findTerminalHttpLinkAtBufferPosition
} from '../../../../src/shared/terminal-link-buffer-hit-testing'

export function notifyTerminalSurfaceTap(
  scope: TerminalDocumentScope,
  originX: number,
  originY: number,
  focusKeyboard: boolean
) {
  const tappedOscLink = oscLinkAtViewportPoint(scope, originX, originY)
  if (tappedOscLink && tappedOscLink.kind === 'file') {
    notify(scope, { type: 'terminal-file-tap', candidates: [tappedOscLink.fileTap] })
    return
  }
  const cell = viewportToCell(scope, originX, originY)
  const term = scope.term
  // Desktop's link detectors take 1-based cells and rebuild rows that wrap.
  const position = cell && term ? { x: cell.col + 1, y: cell.row + 1 } : null
  const tappedUrl =
    tappedOscLink && tappedOscLink.kind === 'url'
      ? tappedOscLink.url
      : position && term
        ? findTerminalHttpLinkAtBufferPosition(term.buffer.active, position, term.cols)
        : null
  if (tappedUrl) {
    notify(scope, { type: 'open-url', url: tappedUrl })
    return
  }
  const fileCandidates =
    position && term
      ? uniqueFileTapCandidates(
          findTerminalFileLinksAtBufferPosition(term.buffer.active, position, term.cols)
        )
      : []
  if (fileCandidates.length > 0) {
    notify(scope, { type: 'terminal-file-tap', candidates: fileCandidates })
    return
  }
  const clickInput = buildMouseClickInput(scope, originX, originY)
  if (clickInput) {
    // Flush pending live text before a click can move the TUI cursor.
    notify(scope, { type: 'terminal-input', bytes: clickInput, click: true })
  }
  // Touch still needs native focus after TUI clicks; unproven mouse encoding falls back to a plain tap.
  if (
    focusKeyboard ||
    !isClickMouseTrackingMode(getMouseTrackingMode(scope)) ||
    !scope.mouseEncodingKnown
  ) {
    notify(scope, { type: 'terminal-tap' })
  }
}

function uniqueFileTapCandidates(links: readonly ParsedFileLinkLocation[]) {
  const seen = new Set<string>()
  const candidates: ParsedFileLinkLocation[] = []
  for (const { pathText, line, column } of links) {
    const key = `${pathText}:${line}:${column}`
    if (!seen.has(key)) {
      seen.add(key)
      candidates.push({ pathText, line, column })
    }
  }
  return candidates
}
