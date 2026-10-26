import { agentHookServer } from '../../../../agent-hooks/server'
import {
  isPotentialQuestionAnsweredSubmitInput,
  isQuestionAnsweredSubmitInput,
  type AgentQuestionAnsweredInferenceRequest
} from '../../../../../shared/agent-question-answered-intent'

/** Snapshot before the write so a hook racing the answer wins over inference, as on desktop. */
export function captureQuestionAnsweredBaseline(
  input: string,
  getPaneKey: () => string | null
): AgentQuestionAnsweredInferenceRequest | null {
  // Reject ordinary input before resolving the pane or parsing prompt JSON.
  if (!isPotentialQuestionAnsweredSubmitInput(input)) {
    return null
  }
  const paneKey = getPaneKey()
  if (!paneKey) {
    return null
  }
  const [row] = agentHookServer.getStatusSnapshotForPane(paneKey)
  if (!row || !isQuestionAnsweredSubmitInput(input, row.interactivePrompt)) {
    return null
  }
  return {
    paneKey,
    baselineUpdatedAt: row.receivedAt,
    baselineStateStartedAt: row.stateStartedAt,
    baselinePrompt: row.prompt,
    baselineAgentType: row.agentType
  }
}

/** Claude sends no hook once a question is answered; clear the wait the answer just ended. */
export function inferQuestionAnsweredAfterWrite(
  baseline: AgentQuestionAnsweredInferenceRequest | null
): void {
  if (baseline) {
    agentHookServer.inferQuestionAnswered(baseline)
  }
}
