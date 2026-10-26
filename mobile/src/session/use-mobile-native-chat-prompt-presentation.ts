import { useCallback } from 'react'
import {
  nativeChatCardDismissKey,
  nativeChatPromptOccurrenceKey
} from '../../../src/shared/native-chat-prompt-dismiss-key'
import type { MobileChatPermission } from './mobile-native-chat-permission'
import { useMobileNativeChatPromptDismiss } from './use-mobile-native-chat-prompt-dismiss'

// Hide/collapse terminal cards locally without changing host prompt status.
export function useMobileNativeChatPromptPresentation({
  permission,
  waitStartedAt,
  scopeKey,
  sessionKey,
  observing,
  respondPermission
}: {
  permission: MobileChatPermission | null
  /** The host wait's start: identical prompts in separate waits are separate occurrences. */
  waitStartedAt: number | null
  scopeKey: string | null
  sessionKey: string | null
  observing: boolean
  respondPermission: (send: string) => Promise<boolean>
}) {
  const card = permission ? { kind: 'approval' as const, approval: permission } : null
  const promptKey = nativeChatPromptOccurrenceKey(card, waitStartedAt)
  const { showPrompt, collapsed, dismissPrompt, collapsePrompt, expandPrompt } =
    useMobileNativeChatPromptDismiss({
      kind: 'prompt',
      content: nativeChatCardDismissKey(card),
      startedAt: waitStartedAt,
      scopeKey,
      sessionKey,
      observing
    })
  const respond = useCallback(
    async (send: string): Promise<boolean> => {
      const accepted = await respondPermission(send)
      if (accepted) {
        dismissPrompt()
      }
      return accepted
    },
    [respondPermission, dismissPrompt]
  )
  return {
    occurrenceKey: promptKey === null ? null : JSON.stringify([scopeKey, sessionKey, promptKey]),
    permission: showPrompt || collapsed ? permission : null,
    collapsePrompt,
    collapsed:
      collapsed && permission ? { title: permission.title, expand: expandPrompt } : null,
    respondPermission: respond
  }
}
