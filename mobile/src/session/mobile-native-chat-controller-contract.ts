import type { StructuredMobileSendAttachment } from './use-mobile-structured-send-with-outcome'
import type { MobileSessionView } from '../storage/session-view-preferences'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { AskAnswerSelection, AskPrompt } from '../../../src/shared/native-chat-ask'
import type { MobileChatPermission } from './mobile-native-chat-permission'
import type { MobileChatQuestion } from './mobile-native-chat-question'
import type {
  NativeChatLiveTurnIndicator,
  NativeChatSettledTurns
} from '../../../src/shared/native-chat-turn-status'
import type { NativeChatTurnJournal } from '../../../src/shared/native-chat-turn-membership'
import type { NativeChatAwaitingInput } from '../../../src/shared/native-chat/native-chat-terminal-turn'
import type { NativeChatResolvedPrompt } from '../../../src/shared/native-chat-resolution-receipt'
import type { MobileNativeChatSendOutcome } from './native-chat/mobile-native-chat-send'
import type { MobileNativeChatCommandRefusalCauses } from './native-chat/use-mobile-native-chat-send-error'
import type { MobileStructuredQueuedMessageControls } from './use-mobile-structured-queued-message-controls'
import type { MobileStructuredBackgroundTasks } from './use-mobile-structured-background-tasks'
import type { MobileNativeChatPendingMessage } from './native-chat/mobile-native-chat-pending-echo'
import type { useMobileNativeChatSession } from './use-mobile-native-chat-session'
import type { MobileNativeChatSessionOptionPickersProps } from './MobileNativeChatSessionOptionPickers'
import type { MobileNativeChatVisualSource } from './mobile-native-chat-visual-read'

export type MobileNativeChatController = {
  sessionViewReady: boolean
  isTabChatView: (tabId: string) => boolean
  setTabView: (tabId: string, view: MobileSessionView) => void
  toggleTabChatView: (tabId: string) => void
  showNativeChat: boolean
  showNativeChatRef: MutableRefObject<boolean>
  nativeChatAgent: string | null
  chatComposerText: string
  setChatComposerText: Dispatch<SetStateAction<string>>
  getChatComposerEditGeneration: () => number
  chatPending: MobileNativeChatPendingMessage[]
  chatImagePreviewsByMessageId: Record<string, string[]>
  nativeChatSession: ReturnType<typeof useMobileNativeChatSession>
  nativeChatStructured: boolean
  nativeChatVisualSource: MobileNativeChatVisualSource | null
  nativeChatItemSource: MobileNativeChatVisualSource | null
  /** Working or waiting on the reader: keeps the turn clock running. */
  nativeChatTurnActive: boolean
  nativeChatAwaitingInput: NativeChatAwaitingInput | null
  nativeChatTurnIndicator: NativeChatLiveTurnIndicator | null
  nativeChatWorkingStartedAt: number | null
  nativeChatSettledTurns: NativeChatSettledTurns | null
  nativeChatTurnJournal: NativeChatTurnJournal | null
  nativeChatReceipts: ReadonlyMap<string, NativeChatResolvedPrompt> | null
  nativeChatActionablePromptIds: readonly string[] | undefined
  nativeChatCommandRefusalCauses: MobileNativeChatCommandRefusalCauses
  nativeChatCanStop: boolean
  nativeChatStreamingText?: string
  nativeChatPermission: MobileChatPermission | null
  // A new prompt occurrence resets local card submission state only.
  nativeChatPromptKey: string | null
  /** Only a structured chat's journal question; a terminal chat's questions are asks. */
  nativeChatQuestion: MobileChatQuestion | null
  // Keep dismissal above chat-view unmounts so toggling views cannot resurrect an answered ask.
  nativeChatAsk: AskPrompt | null
  nativeChatAskKey: string | null
  dismissNativeChatAsk: () => void
  handleNativeChatAnswerAsk: (
    prompt: AskPrompt,
    selections: AskAnswerSelection[]
  ) => Promise<boolean>
  handleNativeChatCancelAsk: () => Promise<boolean>
  // Collapse writes nothing to the terminal and frees Send.
  collapseNativeChatAsk: () => void
  collapseNativeChatPrompt?: () => void
  nativeChatCollapsedPrompt: { title: string; expand: () => void } | null
  handleNativeChatCancelPrompt?: (prompt?: {
    itemId: string
    expectedRevision: number
  }) => Promise<boolean>
  handleNativeChatRespondPermission: (text: string) => Promise<boolean>
  handleNativeChatStop: () => void
  nativeChatQueued: MobileStructuredQueuedMessageControls
  nativeChatBackgroundTasks: MobileStructuredBackgroundTasks | null
  nativeChatFilePaths: string[]
  loadNativeChatFiles: (query: string) => void
  /** A grouped structured answer names the prompt it was rendered for. */
  handleNativeChatQuestionAnswer?: (
    text: string,
    prompt?: MobileChatQuestion['prompt']
  ) => Promise<boolean>
  handleNativeChatSend: (text: string, images?: string[]) => Promise<boolean>
  // Preserve unknown outcomes to heal orphaned image pastes; share their deadline with text and retain the original pre-paste sentAt.
  handleNativeChatSendWithOutcome: (
    text: string,
    images?: string[],
    deadline?: number,
    attachments?: readonly StructuredMobileSendAttachment[],
    sentAt?: number
  ) => Promise<MobileNativeChatSendOutcome>
  // Read parked TUI launch text to clear one line per Ctrl+U before pasting images.
  readSeededLaunchDraft: () => string | null
  nativeChatSessionOptions: MobileNativeChatSessionOptionPickersProps | null
  nativeChatAcceptsImages: boolean
}
