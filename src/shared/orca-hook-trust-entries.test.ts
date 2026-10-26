import { describe, expect, it } from 'vitest'
import {
  canUseRepoWideTrust,
  withOrcaHookRepoAlwaysTrusted,
  withOrcaHookScriptConfirmed
} from './orca-hook-trust-entries'
import type { PersistedTrustedOrcaHooks } from './orca-yaml-hook-types'

describe('orca hook trust entries', () => {
  it('refuses repo-wide trust when the repo id is listed on two hosts', () => {
    const trust: PersistedTrustedOrcaHooks = { 'repo-1': { all: { approvedAt: 1000 } } }

    expect(canUseRepoWideTrust(trust, [{ id: 'repo-1' }], 'repo-1')).toBe(true)
    expect(canUseRepoWideTrust(trust, [{ id: 'repo-1' }, { id: 'repo-1' }], 'repo-1')).toBe(false)
  })

  it('preserves unrelated trust entries when confirming a script', () => {
    const trust: PersistedTrustedOrcaHooks = {
      'repo-1': { archive: { contentHash: 'archive-hash', approvedAt: 1000 } }
    }

    expect(withOrcaHookScriptConfirmed(trust, 'repo-1', 'setup', 'setup-hash', 2000)).toEqual({
      'repo-1': {
        archive: { contentHash: 'archive-hash', approvedAt: 1000 },
        setup: { contentHash: 'setup-hash', approvedAt: 2000 }
      }
    })
  })

  it('records always-trust without dropping existing script approvals', () => {
    const trust: PersistedTrustedOrcaHooks = {
      'repo-1': { setup: { contentHash: 'setup-hash', approvedAt: 1000 } }
    }

    expect(withOrcaHookRepoAlwaysTrusted(trust, 'repo-1', 2000)).toEqual({
      'repo-1': {
        setup: { contentHash: 'setup-hash', approvedAt: 1000 },
        all: { approvedAt: 2000 }
      }
    })
  })
})
