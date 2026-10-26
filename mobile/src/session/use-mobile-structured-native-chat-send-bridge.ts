import { useCallback } from 'react'
import type { StructuredAgentId } from '../../../src/shared/agent-session-provider-handle'
import { isStructuredAgentSessionComposerCommand } from '../../../src/shared/structured-agent-session-composer'
import type { MobileNativeChatSendOutcome } from './native-chat/mobile-native-chat-send'
import type { MobileNativeChatSendOrigin } from './native-chat/mobile-native-chat-pending-echo'
import type { StructuredMobileSendAttachment } from './use-mobile-structured-send-with-outcome'
import type { AgentJournalSkillRef } from '../../../src/shared/agent-session-journal-types'
import {
  readMobileNativeChatPickedSkills,
  restoreMobileNativeChatPickedSkills
} from './native-chat/composer/mobile-native-chat-draft-store'

export function useMobileStructuredNativeChatSendBridge(args: {
  agent: StructuredAgentId | undefined
  sendStructured: (
    text: string,
    images?: string[],
    deadline?: number,
    attachments?: readonly StructuredMobileSendAttachment[],
    skills?: readonly AgentJournalSkillRef[]
  ) => Promise<MobileNativeChatSendOutcome>
  captureSendOrigin: (text: string) => MobileNativeChatSendOrigin | null
  clearDraftForSend: (origin: MobileNativeChatSendOrigin, text: string) => void
  restoreRejectedDraft: (origin: MobileNativeChatSendOrigin, text: string) => void
  onSendError: (message: string) => void
}): {
  send: (text: string, images?: string[]) => Promise<boolean>
  sendWithOutcome: (
    text: string,
    images?: string[],
    deadline?: number,
    attachments?: readonly StructuredMobileSendAttachment[]
  ) => Promise<MobileNativeChatSendOutcome>
} {
  const {
    agent,
    captureSendOrigin,
    clearDraftForSend,
    onSendError,
    restoreRejectedDraft,
    sendStructured
  } = args
  const sendWithOutcome = useCallback(
    async (
      text: string,
      images?: string[],
      deadline?: number,
      attachments?: readonly StructuredMobileSendAttachment[]
    ): Promise<MobileNativeChatSendOutcome> => {
      const origin = captureSendOrigin(text.trimEnd())
      if (!origin) {
        onSendError('Message not sent (disconnected)')
        return 'rejected'
      }
      const isHostCommand = isStructuredAgentSessionComposerCommand(text, agent)
      // Clearing the draft forgets its picks, so read them first.
      const skills = readMobileNativeChatPickedSkills(origin.draftKey)
      clearDraftForSend(origin, text)
      const outcome =
        skills.length > 0
          ? await sendStructured(text, images, deadline, attachments, skills)
          : attachments !== undefined
            ? await sendStructured(text, images, deadline, attachments)
            : deadline !== undefined
              ? await sendStructured(text, images, deadline)
              : images !== undefined
                ? await sendStructured(text, images)
                : await sendStructured(text)
      // Accepted messages remain host-owned; restore commands whose reply was lost.
      if (outcome === 'rejected' || (outcome === 'unknown' && isHostCommand)) {
        restoreRejectedDraft(origin, text)
        restoreMobileNativeChatPickedSkills(origin.draftKey, skills)
      }
      return outcome
    },
    [agent, captureSendOrigin, clearDraftForSend, onSendError, restoreRejectedDraft, sendStructured]
  )
  const send = useCallback(
    async (
      text: string,
      images?: string[],
      deadline?: number,
      attachments?: readonly StructuredMobileSendAttachment[]
    ) => (await sendWithOutcome(text, images, deadline, attachments)) !== 'rejected',
    [sendWithOutcome]
  )
  return { send, sendWithOutcome }
}
