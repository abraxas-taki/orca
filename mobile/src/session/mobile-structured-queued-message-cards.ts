// The shared projection decides each card's hold; this layer words it for the phone.

import {
  readWholeAgentSessionFailureFact,
  type AgentSessionFailureFact
} from '../../../src/shared/agent-session-failure'
import { agentSessionFailureStatedByRow } from '../../../src/shared/agent-session-visible-failures'
import {
  agentSessionWriteNotDoneParts,
  agentSessionWriteNoticeEnglish
} from '../../../src/shared/agent-session-refusal-notice'
import type { AgentJournalSubmission } from '../../../src/shared/agent-session-journal-types'
import { dispatchWasWithdrawn } from '../../../src/shared/structured-agent-session-dispatch-rejection'
import { structuredAgentSessionAttemptFailureParts } from '../../../src/shared/structured-agent-session-rejection-words'
import {
  QUEUED_MESSAGE_PAUSED_SEND_FAILED,
  type AgentSessionQueuedMessage
} from '../../../src/shared/agent-session-wire'
import {
  projectQueuedMessageCards,
  queuedMessageCardLine,
  type QueuedMessageCard
} from '../../../src/shared/structured-agent-session-queued-cards'
import { agentMessageAttribution } from './mobile-agent-message-attribution'

export type MobileQueuedMessageCard = QueuedMessageCard & {
  /** The text, or for a card of images alone, the image's name or their count. */
  line: string
  needsAttention: boolean
  // Leave plain waits uncaptioned; the question or queue-pause row already explains the hold.
  caption: string | null
  attribution: string | null
}

function returnedCaption(
  card: QueuedMessageCard,
  agentName?: string,
  statedFailures: readonly AgentSessionFailureFact[] = []
): string {
  const reason = card.returnedReason ?? null
  const rejection = card.returnedRejection
  if (agentSessionFailureStatedByRow(rejection, statedFailures)) {
    return agentSessionWriteNoticeEnglish(agentSessionWriteNotDoneParts('send'))
  }
  if (dispatchWasWithdrawn({ dispatchState: 'rejected', reason, rejection })) {
    return 'Stopped before it was sent'
  }
  // Reuse desktop failure wording but omit retry instructions: this card’s Send is the retry.
  return agentSessionWriteNoticeEnglish(
    structuredAgentSessionAttemptFailureParts(
      { kind: 'rejected', reason },
      { agentName, retryControl: true },
      readWholeAgentSessionFailureFact(rejection)
    )
  )
}

function queuedMessageCardCaption(
  card: QueuedMessageCard,
  agentName?: string,
  statedFailures?: readonly AgentSessionFailureFact[]
): string | null {
  switch (card.hold) {
    case 'returned':
      return returnedCaption(card, agentName, statedFailures)
    case 'paused':
      // Absent or unknown (newer host) marker: a plain pause, promising no release rule.
      if (card.pausedReason !== QUEUED_MESSAGE_PAUSED_SEND_FAILED) {
        return 'Paused'
      }
      return card.waitsForAgent
        ? "Couldn't send — tap Send to retry once the agent finishes"
        : "Couldn't send — tap Send to retry"
    case 'behind-returned':
      return 'Waiting — a message ahead needs attention'
    case 'sending':
      return 'Sending…'
    case 'turn':
    case 'queue-paused':
      return null
  }
}

export function mobileQueuedMessageCards(
  queuedMessages: readonly AgentSessionQueuedMessage[] | null | undefined,
  submissions: readonly AgentJournalSubmission[],
  facts: {
    agentWorking?: boolean
    queuePaused?: boolean
    agentName?: string
    statedFailures?: readonly AgentSessionFailureFact[]
  } = {}
): MobileQueuedMessageCard[] {
  return projectQueuedMessageCards(queuedMessages, submissions, facts).map((card) => ({
    ...card,
    line: queuedMessageCardLine(card),
    needsAttention:
      card.state === 'returned' || card.pausedReason === QUEUED_MESSAGE_PAUSED_SEND_FAILED,
    caption: queuedMessageCardCaption(card, facts.agentName, facts.statedFailures),
    attribution: agentMessageAttribution('From', card.from)
  }))
}
