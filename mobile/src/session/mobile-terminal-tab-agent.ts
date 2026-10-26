import { stripLeadingAgentTitleDecorationOrEmpty } from '../../../src/shared/agent-title-decoration'
import { agentTypeToIconAgent } from '../../../src/shared/agent-type-icon-agent'
import { resolveTabAgentFromSignalSnapshot } from '../../../src/shared/tab-agent-from-signals'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import { isBlankBrowserUrl } from '../browser/browser-url'
import type { MobileSessionTab } from './mobile-session-route-types'

type MobileTerminalTabAgentIdentity = {
  title: string
  agentStatus?: Pick<AgentStatusEntry, 'agentType' | 'state'> | null
  launchAgent?: TuiAgent | null
}

export function getMobileTerminalTabHostAgentIdentity(
  tab: MobileSessionTab,
  terminals: readonly { handle: string; agentIdentity?: string }[]
): string | undefined {
  if (tab.type !== 'terminal' || !tab.terminal) {
    return undefined
  }
  return terminals.find((terminal) => terminal.handle === tab.terminal)?.agentIdentity
}

// Cursor imports Claude hooks; older hosts still report them as claude, so the host identity corrects that.
function correctCursorImportedHookAgent(
  hookAgentType: string | undefined,
  hostAgentIdentity: string | null | undefined
): string | undefined {
  return hookAgentType === 'claude' && hostAgentIdentity === 'cursor' ? 'cursor' : hookAgentType
}

export function resolveMobileTerminalTabOwnedAgentId(
  tab: MobileTerminalTabAgentIdentity,
  hostAgentIdentity?: string | null
): string | null {
  const hookAgentType = tab.agentStatus?.agentType?.trim()
  if (hookAgentType && hookAgentType !== 'unknown') {
    return correctCursorImportedHookAgent(hookAgentType, hostAgentIdentity) ?? null
  }
  if (tab.launchAgent) {
    return tab.launchAgent
  }
  return null
}

// Phones receive no process, sleeping-session or sibling-pane signals, so the desktop rule runs on hook, launch and title.
export function resolveMobileTerminalTabAgentId(
  tab: MobileTerminalTabAgentIdentity,
  hostAgentIdentity?: string | null
): string | null {
  const status = tab.agentStatus
  const hookAgent = agentTypeToIconAgent(
    correctCursorImportedHookAgent(status?.agentType, hostAgentIdentity)
  )
  const agent = resolveTabAgentFromSignalSnapshot({
    title: tab.title,
    hookAgent: status?.state === 'done' ? null : hookAgent,
    focusedCompletedHookAgent: status?.state === 'done' ? hookAgent : null,
    launchAgent: tab.launchAgent ?? undefined
  })
  return agent ?? (hostAgentIdentity === 'cursor' ? 'cursor' : null)
}

export function getMobileSessionTabTitle(
  tab: MobileSessionTab,
  hostAgentIdentity?: string | null
): string {
  if (tab.type === 'browser') {
    const title = tab.title.trim()
    if (title && !isBlankBrowserUrl(title)) {
      return title
    }
    if (isBlankBrowserUrl(tab.url)) {
      return 'New Browser'
    }
    return 'Browser'
  }
  if (tab.type === 'markdown') {
    return tab.title || 'Markdown'
  }
  if (tab.type === 'file') {
    return tab.title || 'File'
  }
  if (tab.type === 'agent-session') {
    return tab.title || 'Chat'
  }
  // Strip status glyphs when showing provider icons; glyph-only iOS titles otherwise leave stray colored boxes.
  if (resolveMobileTerminalTabAgentId(tab, hostAgentIdentity)) {
    return stripLeadingAgentTitleDecorationOrEmpty(tab.title) || 'Terminal'
  }
  return tab.title || 'Terminal'
}
