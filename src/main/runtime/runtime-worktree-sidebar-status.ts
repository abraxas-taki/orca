import { isAgentStatusFresh } from '../../shared/agent-status-freshness'
import type { RuntimeWorktreePsSummary } from '../../shared/runtime-types'
import {
  applyAgentPaneActivityFlags,
  rankWorktreeStatus,
  type AgentPaneActivityFlags,
  type WorktreeStatus
} from '../../shared/worktree-status-rollup'

/** The desktop sidebar dot: host status stands in for the title heuristic under fresh agent verdicts. */
export function resolveRuntimeWorktreeSidebarStatus(
  summary: Pick<RuntimeWorktreePsSummary, 'status' | 'agents'>,
  now: number,
  /** The highest title status left after desktop's pane suppression; null when none remains. */
  titleStatus: 'working' | 'permission' | null
): WorktreeStatus {
  const flags: AgentPaneActivityFlags = {
    hasPermission: false,
    hasLiveWorking: false,
    hasLiveMonitoring: false,
    hasFailed: false,
    hasInterrupted: false,
    hasUnconfirmed: false,
    hasLiveDone: false
  }
  for (const row of summary.agents) {
    if (isAgentStatusFresh(row, now)) {
      applyAgentPaneActivityFlags(flags, row)
    }
  }
  // Why: desktop ignores titles of panes with a fresh agent row; live rows return through the flags.
  const heuristic =
    summary.status === 'working' || summary.status === 'permission'
      ? (titleStatus ?? 'active')
      : summary.status
  return rankWorktreeStatus(heuristic, flags)
}
