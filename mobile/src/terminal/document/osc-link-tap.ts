import { cellColToStringIndex, getLineText } from './cell-geometry'
import { viewportToCell } from './viewport-cell'
import type {
  TerminalDocumentLine,
  TerminalDocumentScope,
  TerminalInitialOscLink,
  TerminalOscLinkService
} from './document-scope'
import { isWindowsAbsolutePathLike } from '../../../../src/shared/cross-platform-path'
import type { ParsedFileLinkLocation } from '../../../../src/shared/file-link-location'
import { resolveTerminalFileUrlTarget } from '../../../../src/shared/terminal-file-url-target'
import { findExactTerminalFileLink } from '../../../../src/shared/terminal-links'

export type TerminalOscLinkTarget =
  | { kind: 'url'; url: string }
  | { kind: 'file'; fileTap: ParsedFileLinkLocation }

// OSC 8 labels may hide the URL; probe guarded xterm internals and fall through when unavailable.
export function oscLinkService(scope: TerminalDocumentScope): TerminalOscLinkService | null {
  try {
    const core = scope.term && scope.term._core
    if (!core) {
      return null
    }
    return (
      core._oscLinkService || (core._inputHandler && core._inputHandler._oscLinkService) || null
    )
  } catch {
    return null
  }
}

export function oscLinkAtViewportPoint(
  scope: TerminalDocumentScope,
  clientX: number,
  clientY: number
) {
  try {
    const cell = viewportToCell(scope, clientX, clientY)
    if (!cell) {
      return null
    }
    const line = scope.term!.buffer.active.getLine(cell.row)
    if (!line) {
      return null
    }
    const urlId = oscLinkIdAtCell(line, cell.col)
    if (!urlId) {
      return initialOscLinkAtCell(scope, cell.row, cell.col)
    }
    const svc = oscLinkService(scope)
    if (!svc || !svc.getLinkData) {
      return initialOscLinkAtCell(scope, cell.row, cell.col)
    }
    const data = svc.getLinkData(urlId)
    const uri = data && data.uri
    return terminalOscLinkTarget(uri)
  } catch {
    return null
  }
}

export function initialOscLinkAtCell(scope: TerminalDocumentScope, row: number, col: number) {
  for (let i = 0; i < scope.initialOscLinks.length; i++) {
    const link = scope.initialOscLinks[i]
    if (!link || typeof link.uri !== 'string') {
      continue
    }
    if (link.row < scope.initialOscLinkRowOffset) {
      continue
    }
    const shiftedRow = link.row - scope.initialOscLinkRowOffset
    if (
      shiftedRow === row &&
      col >= link.startCol &&
      col < link.endCol &&
      initialOscLinkTextStillMatches(scope, link, shiftedRow)
    ) {
      return terminalOscLinkTarget(link.uri)
    }
  }
  return null
}

export function terminalOscLinkTarget(uri: unknown): TerminalOscLinkTarget | null {
  if (typeof uri !== 'string') {
    return null
  }
  // Mirror desktop's OSC 8 routing; the host resolves paths, so no cwd is needed here.
  const windowsPath = isWindowsAbsolutePathLike(uri) ? oscFileTarget(uri) : null
  if (windowsPath) {
    return windowsPath
  }
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch {
    return oscFileTarget(uri)
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return { kind: 'url', url: parsed.toString() }
  }
  if (parsed.protocol !== 'file:') {
    return null
  }
  // Desktop allows UNC hosts only on Windows; the phone can't tell, so the host's resolver decides.
  const resolved = resolveTerminalFileUrlTarget(parsed, { allowUncHost: true })
  return resolved
    ? {
        kind: 'file',
        fileTap: { pathText: resolved.filePath, line: resolved.line, column: resolved.column }
      }
    : null
}

function oscFileTarget(uri: string): TerminalOscLinkTarget | null {
  const link = findExactTerminalFileLink(uri)
  return link
    ? { kind: 'file', fileTap: { pathText: link.pathText, line: link.line, column: link.column } }
    : null
}

export function captureInitialOscLinkTexts(scope: TerminalDocumentScope) {
  if (!Array.isArray(scope.initialOscLinks)) {
    return
  }
  for (let i = 0; i < scope.initialOscLinks.length; i++) {
    const link = scope.initialOscLinks[i]
    if (!link || typeof link.text === 'string') {
      continue
    }
    link.text = initialOscLinkTextAtRow(scope, link, link.row)
  }
}

export function initialOscLinkTextStillMatches(
  scope: TerminalDocumentScope,
  link: TerminalInitialOscLink,
  row: number
) {
  if (typeof link.text !== 'string') {
    return false
  }
  return link.text.length > 0 && initialOscLinkTextAtRow(scope, link, row) === link.text
}

export function initialOscLinkTextAtRow(
  scope: TerminalDocumentScope,
  link: TerminalInitialOscLink,
  row: number
) {
  try {
    const lineText = getLineText(scope, row)
    const start = cellColToStringIndex(scope, row, link.startCol)
    const end = cellColToStringIndex(scope, row, link.endCol)
    return lineText.slice(start, end)
  } catch {
    return ''
  }
}

export function oscLinkIdAtCell(line: TerminalDocumentLine, col: number) {
  try {
    const bufCell = line.getCell!(col)
    return bufCell && bufCell.extended && bufCell.extended.urlId ? bufCell.extended.urlId : 0
  } catch {
    return 0
  }
}
