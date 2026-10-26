import { describe, expect, it } from 'vitest'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../shared/agent-status-freshness'
import type { RuntimeWorktreeAgentRow } from '../../shared/runtime-types'
import { resolveRuntimeWorktreeSidebarStatus } from './runtime-worktree-sidebar-status'

const NOW = 10_000_000

function doneRow(
  outcome: 'failure' | 'cancellation' | 'unconfirmed' | 'success',
  updatedAt = NOW
): RuntimeWorktreeAgentRow {
  return {
    paneKey: 'tab-1:1',
    parentPaneKey: null,
    state: 'done',
    agentType: 'claude',
    prompt: '',
    taskTitle: null,
    displayName: null,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    mainAgent: { state: 'done', outcome, stateStartedAt: updatedAt },
    stateStartedAt: updatedAt,
    updatedAt
  }
}

describe('resolveRuntimeWorktreeSidebarStatus', () => {
  it.each([
    ['failure', 'failed'],
    ['cancellation', 'interrupted'],
    ['unconfirmed', 'unconfirmed'],
    ['success', 'done']
  ] as const)('reads a finished %s turn as the desktop dot %s', (outcome, expected) => {
    expect(
      resolveRuntimeWorktreeSidebarStatus(
        { status: 'active', agents: [doneRow(outcome)] },
        NOW,
        null
      )
    ).toBe(expected)
  })

  it('keeps another pane’s pending question above a failed turn, but not the failed pane’s own title', () => {
    const summary = { status: 'permission' as const, agents: [doneRow('failure')] }
    expect(resolveRuntimeWorktreeSidebarStatus(summary, NOW, 'permission')).toBe('permission')
    expect(resolveRuntimeWorktreeSidebarStatus(summary, NOW, null)).toBe('failed')
  })

  it('falls back to the host status once the agent row is stale', () => {
    expect(
      resolveRuntimeWorktreeSidebarStatus(
        {
          status: 'active',
          agents: [doneRow('failure', NOW - AGENT_STATUS_STALE_AFTER_MS - 1)]
        },
        NOW,
        null
      )
    ).toBe('active')
  })

  it('lets a finished turn show through its own pane’s lingering working title', () => {
    const summary = { status: 'working' as const, agents: [doneRow('success')] }
    expect(resolveRuntimeWorktreeSidebarStatus(summary, NOW, null)).toBe('done')
    expect(resolveRuntimeWorktreeSidebarStatus(summary, NOW, 'working')).toBe('working')
  })
})
