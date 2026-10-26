import { formatAgentImagePath } from './agent-image-paste'
import { isWindowsAbsolutePathLike } from './cross-platform-path'
import { formatImageDropPasteText } from './image-path-paste'
import { isWslUncPath } from './wsl-paths'

export function isTerminalDropWindowsPathLike(path: string): boolean {
  if (isWslUncPath(path)) {
    return false
  }
  return isWindowsAbsolutePathLike(path) || path.includes('\\')
}

/** Escape image paths as terminal drops do; agent TUIs unescape before checking file existence. */
export function agentImagePastePath(agent: string | null | undefined, path: string): string {
  const formatted = formatAgentImagePath(agent, path)
  if (formatted !== path) {
    return formatted
  }
  const targetShell = isTerminalDropWindowsPathLike(path) ? 'windows' : 'posix'
  return formatImageDropPasteText(path, targetShell) ?? path
}
