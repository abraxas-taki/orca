import { notify } from './host-notify'
import { getMouseTrackingMode } from './mouse-input-encoding'
import type { TerminalDocumentScope } from './document-scope'

export function emitModesIfChanged(scope: TerminalDocumentScope) {
  if (!scope.term) {
    return
  }
  const bp = !!(scope.term.modes && scope.term.modes.bracketedPasteMode)
  const applicationCursorKeysMode = !!scope.term.modes?.applicationCursorKeysMode
  let alt = false
  const mouseTrackingMode = getMouseTrackingMode(scope)
  try {
    alt =
      scope.term.buffer && scope.term.buffer.active && scope.term.buffer.active.type === 'alternate'
  } catch {}
  if (
    bp !== scope.lastEmittedModes.bracketedPasteMode ||
    alt !== scope.lastEmittedModes.altScreen ||
    mouseTrackingMode !== scope.lastEmittedModes.mouseTrackingMode ||
    scope.sgrMouseMode !== scope.lastEmittedModes.sgrMouseMode ||
    scope.sgrMousePixelsMode !== scope.lastEmittedModes.sgrMousePixelsMode ||
    applicationCursorKeysMode !== scope.lastEmittedModes.applicationCursorKeysMode
  ) {
    scope.lastEmittedModes = {
      bracketedPasteMode: bp,
      altScreen: alt,
      mouseTrackingMode: mouseTrackingMode,
      sgrMouseMode: scope.sgrMouseMode,
      sgrMousePixelsMode: scope.sgrMousePixelsMode,
      applicationCursorKeysMode
    }
    notify(scope, {
      type: 'modes',
      bracketedPasteMode: bp,
      altScreen: alt,
      mouseTrackingMode: mouseTrackingMode,
      sgrMouseMode: scope.sgrMouseMode,
      sgrMousePixelsMode: scope.sgrMousePixelsMode,
      applicationCursorKeysMode
    })
  }
}
