import '../../../unused-default-rpc-methods.test-fixture'
import type { StructuredAgentSessionSendMutation } from '../../../../../../shared/structured-agent-session-send-mutation'
import { afterEach, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from '../../../../orca-runtime'
import { partialRuntimeStore } from '../../../../runtime-store-partial-fixture'
import { OrchestrationDb } from '../../../../orchestration/db'
import { createRootDispatch } from '../../../../orchestration/db/root-dispatch-test-fixture'
import { expectHeartbeatBrief } from '../../../../orchestration/dispatch-heartbeat-contract.test-support'
import { deliverWorkerDispatchPreamble } from './deliver-worker-dispatch-preamble'

let db: OrchestrationDb

afterEach(() => {
  db?.close()
  vi.restoreAllMocks()
})

it.each([
  { transport: 'terminal', saved: undefined },
  { transport: 'terminal', saved: false },
  { transport: 'structured', saved: undefined },
  { transport: 'structured', saved: false }
])(
  'delivers the actual worker brief over $transport with preference $saved',
  async ({ transport, saved }) => {
    db = new OrchestrationDb(':memory:')
    const runtime = new OrcaRuntimeService(
      partialRuntimeStore({ getSettings: () => ({ orchestrationHeartbeatsEnabled: saved }) })
    )
    const run = db.createRun({
      objective: 'deliver brief',
      coordinatorHandle: 'term_coord',
      coordinatorPaneKey: 'tab_coord:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    })
    const task = db.createTask({ spec: 'complete the requested work', runId: run.id })
    const dispatch = createRootDispatch(db, task.id, 'term_worker')
    const terminalSend = vi
      .spyOn(runtime, 'sendTerminalAgentPrompt')
      .mockResolvedValue({ handle: 'term_worker', accepted: true, bytesWritten: 1 })
    const structuredSend = vi.fn(
      async (_caller: unknown, _message: StructuredAgentSessionSendMutation) => ({
        ok: true,
        value: {
          clientMessageId: 'message_1',
          submission: { clientMessageId: 'message_1', dispatchState: 'accepted', reason: null }
        }
      })
    )
    const session = {
      host: {
        deps: { store: { getRecord: () => ({ lease: { runtimeFence: 1 } }) } },
        send: structuredSend,
        waitForSendSettlement: vi.fn()
      },
      identity: { sessionId: '7e3b9d15-2c4a-4f86-a0b1-5c9e2d7f3b64' }
    }
    const args = {
      runtime,
      db,
      structuredSession: transport === 'structured' ? session : null,
      terminalHandle: 'term_worker',
      dispatchId: dispatch.id,
      dispatchDepth: dispatch.depth,
      runId: run.id,
      taskId: task.id,
      taskSpec: task.spec,
      coordinatorHandle: 'term_coord',
      devMode: false,
      requestId: 'request_brief'
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: delivery reads only this structured host's send, settlement, durable fence and session identity.
    const receipt = await deliverWorkerDispatchPreamble(args as never)
    if (transport === 'terminal') {
      expect(terminalSend).toHaveBeenCalledOnce()
      expectHeartbeatBrief(terminalSend.mock.calls[0]?.[1], saved !== false)
      expect(structuredSend).not.toHaveBeenCalled()
    } else {
      expect(receipt.structuredTurnStart).toEqual({ verdict: 'observed' })
      expect(structuredSend).toHaveBeenCalledOnce()
      expect(terminalSend).not.toHaveBeenCalled()
      const body = structuredSend.mock.calls[0]?.[1].body
      expectHeartbeatBrief(
        body?.blocks
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join(''),
        saved !== false
      )
    }
  }
)
