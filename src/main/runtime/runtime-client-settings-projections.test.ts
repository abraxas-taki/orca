import { expect, it, vi } from 'vitest'
import { partialRuntimeStore } from './runtime-store-partial-fixture'
import { RuntimeClientSettingsController } from './runtime-client-settings'
import './runtime-client-settings-minimax-projection.spec'
import './runtime-client-settings-linear-team-projection.spec'
import './runtime-client-settings-source-control-projection.spec'
import './runtime-client-settings-terminal-copy-projection.spec'

vi.mock('../claude/agent-view-service', () => ({
  getClaudeAgentViewService: () => ({ reconcile: async () => {} })
}))

it.each([true, false])('keeps heartbeat preference %s local to the execution host', (enabled) => {
  const store = partialRuntimeStore({
    getSettings: () => ({ orchestrationHeartbeatsEnabled: enabled })
  })
  expect(new RuntimeClientSettingsController(store).get()).not.toHaveProperty(
    'orchestrationHeartbeatsEnabled'
  )
})
