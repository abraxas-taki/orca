import { describe, expect, it } from 'vitest'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { AGENT_TURN_OUTCOMES } from '../../../src/shared/agent-turn-outcome'
import { isAgentStatusFresh } from '../../../src/shared/agent-status-freshness'
import {
  agentDisplayLabel,
  agentDotState,
  agentRowTimeAt,
  formatTimeAgo
} from './agent-row-display'

type Outcome = (typeof AGENT_TURN_OUTCOMES)[number]
const mainAgentDone = (outcome: Outcome, stateStartedAt = 0) => ({
  mainAgent: { state: 'done' as const, outcome, stateStartedAt }
})

function row(overrides: Partial<RuntimeWorktreeAgentRow> = {}): RuntimeWorktreeAgentRow {
  return {
    paneKey: 'p',
    parentPaneKey: null,
    state: 'working',
    agentType: 'claude',
    prompt: '',
    taskTitle: null,
    displayName: null,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

describe('agentDotState', () => {
  it('maps known states through and unknown to idle', () => {
    expect(agentDotState(row({ state: 'working', updatedAt: 0 }), 0)).toBe('working')
    expect(
      agentDotState(row({ state: 'working', workingMode: 'monitoring', updatedAt: 0 }), 0)
    ).toBe('monitoring')
    expect(agentDotState(row({ state: 'blocked', updatedAt: 0 }), 0)).toBe('blocked')
    expect(agentDotState(row({ state: 'waiting', updatedAt: 0 }), 0)).toBe('waiting')
    expect(agentDotState(row({ state: 'done', updatedAt: 0 }), 0)).toBe('done')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: unparsed rows can carry a future host state.
    expect(agentDotState(row({ state: 'unknown-state' as never }), 0)).toBe('idle')
  })

  it("reports the verdict of a done row: failed, or a user's Stop (also an old host's flag) as interrupted", () => {
    expect(agentDotState(row({ state: 'done', interrupted: true }), 0)).toBe('interrupted')
    expect(agentDotState(row({ state: 'done', ...mainAgentDone('failure') }), 0)).toBe('failed')
    expect(
      agentDotState(row({ state: 'done', ...mainAgentDone('cancellation'), interrupted: true }), 0)
    ).toBe('interrupted')
    expect(agentDotState(row({ state: 'done', ...mainAgentDone('success') }), 0)).toBe('done')
    expect(agentDotState(row({ state: 'done', ...mainAgentDone('superseded') }), 0)).toBe(
      'interrupted'
    )
  })

  it('reads a crash-cut turn as failed and an unproven end as unconfirmed', () => {
    expect(agentDotState(row({ state: 'done', ...mainAgentDone('interruption') }), 0)).toBe(
      'failed'
    )
    expect(agentDisplayLabel(row({ state: 'done', ...mainAgentDone('interruption') }), 0)).toBe(
      'Failed'
    )
    expect(agentDotState(row({ state: 'done', ...mainAgentDone('unconfirmed') }), 0)).toBe(
      'unconfirmed'
    )
    expect(agentDisplayLabel(row({ state: 'done', ...mainAgentDone('unconfirmed') }), 0)).toBe(
      'Couldn’t confirm'
    )
  })

  // Unparsed rows may carry a future outcome; keep the done fallback.
  it('reads a done row carrying an outcome it cannot name as done', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: an arm from a newer host, which the unparsed wire row can carry.
    const future = mainAgentDone('from-a-newer-host' as Outcome)
    expect(agentDotState(row({ state: 'done', ...future }), 0)).toBe('done')
  })

  it('shows a main agent that failed while its subagents still run as failed', () => {
    expect(agentDotState(row({ state: 'working', ...mainAgentDone('failure') }), 0)).toBe('failed')
    expect(agentDotState(row({ state: 'waiting', ...mainAgentDone('failure') }), 0)).toBe('failed')
    expect(agentDotState(row({ state: 'working', ...mainAgentDone('interruption') }), 0)).toBe(
      'failed'
    )
    expect(agentDotState(row({ state: 'working', ...mainAgentDone('success') }), 0)).toBe('working')
    expect(
      agentDotState(
        row({ state: 'working', ...mainAgentDone('cancellation'), interrupted: true }),
        0
      )
    ).toBe('working')
  })

  it('decays a stale active state to idle, matching desktop', () => {
    const stale = 1_800_001
    expect(agentDotState(row({ state: 'working', updatedAt: 0, hasLivePty: true }), stale)).toBe(
      'unverifiable'
    )
    expect(agentDotState(row({ state: 'working', updatedAt: 0 }), stale)).toBe('idle')
    expect(agentDotState(row({ state: 'blocked', updatedAt: 0 }), stale)).toBe('idle')
    expect(agentDotState(row({ state: 'waiting', updatedAt: 0 }), stale)).toBe('idle')
    expect(agentDotState(row({ state: 'working', updatedAt: 0 }), 1_800_000)).toBe('working')
    expect(agentDotState(row({ state: 'done', updatedAt: 0 }), stale)).toBe('done')
    expect(
      agentDotState(row({ state: 'done', updatedAt: 0, ...mainAgentDone('interruption') }), stale)
    ).toBe('failed')
  })

  // Title renewal updates the row timestamp without renewing status evidence.
  it('ages a status by its evidence, not by a later title renewal, as desktop does', () => {
    const now = 100 * 60 * 1000
    const renewed = {
      state: 'blocked' as const,
      updatedAt: now,
      evidenceObservedAt: now - 31 * 60 * 1000
    }
    expect(isAgentStatusFresh(renewed, now)).toBe(false)
    expect(agentDotState(renewed, now)).toBe('idle')
  })
})

describe('agentRowTimeAt', () => {
  it('dates a main agent that failed while its subagents run by its own failure', () => {
    expect(
      agentRowTimeAt(
        row({ state: 'working', stateStartedAt: 100, ...mainAgentDone('failure', 900) })
      )
    ).toBe(900)
  })

  it('dates every other row by when its state began', () => {
    expect(
      agentRowTimeAt(
        row({ state: 'working', stateStartedAt: 100, ...mainAgentDone('success', 900) })
      )
    ).toBe(100)
    expect(
      agentRowTimeAt(row({ state: 'done', stateStartedAt: 100, ...mainAgentDone('failure', 900) }))
    ).toBe(100)
    expect(agentRowTimeAt(row({ state: 'working', stateStartedAt: 100 }))).toBe(100)
  })
})

describe('agentDisplayLabel', () => {
  it('prefers last message, then prompt, then state label', () => {
    expect(agentDisplayLabel(row({ lastAssistantMessage: 'hello there' }), 0)).toBe('hello there')
    expect(agentDisplayLabel(row({ lastAssistantMessage: '   ', prompt: 'do the thing' }), 0)).toBe(
      'do the thing'
    )
    expect(agentDisplayLabel(row({ state: 'working', prompt: '', updatedAt: 0 }), 0)).toBe(
      'Working'
    )
    expect(
      agentDisplayLabel(
        row({ state: 'working', workingMode: 'monitoring', prompt: '', updatedAt: 0 }),
        0
      )
    ).toBe('Monitoring background tasks')
  })

  it("says Stopping while the host says a person's Stop is ending the turn", () => {
    const stopping = row({
      lastAssistantMessage: 'hello there',
      mainAgent: { state: 'working', stopping: true, stateStartedAt: 0 }
    })
    expect(agentDisplayLabel(stopping, 0)).toBe('Stopping…')
    expect(agentDotState(stopping, 0)).toBe('working')
  })

  it('falls back to the decayed state label when stale', () => {
    expect(agentDisplayLabel(row({ state: 'working', prompt: '', updatedAt: 0 }), 1_800_001)).toBe(
      'Idle'
    )
  })

  it('reports how long a stale row on a live terminal has been silent, like desktop', () => {
    const silent = row({ state: 'working', prompt: 'build', updatedAt: 0, hasLivePty: true })
    expect(agentDisplayLabel(silent, 40 * 60_000)).toBe('No update in 40m')
  })
})

describe('formatTimeAgo', () => {
  const now = 10_000_000
  it('formats across thresholds', () => {
    expect(formatTimeAgo(now - 30_000, now)).toBe('just now')
    expect(formatTimeAgo(now - 5 * 60_000, now)).toBe('5m')
    expect(formatTimeAgo(now - 3 * 3_600_000, now)).toBe('3h')
    expect(formatTimeAgo(now - 2 * 86_400_000, now)).toBe('2d')
  })
})
