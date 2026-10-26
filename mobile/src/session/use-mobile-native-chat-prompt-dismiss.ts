import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { nativeChatPromptDismissalMatches } from '../../../src/shared/native-chat-prompt-dismiss-key'
import {
  mobileNativeChatPromptDismissals as dismissals,
  type MobileNativeChatPromptDismissal
} from './mobile-native-chat-prompt-dismissals'

type DetectedPrompt = { sessionKey: string | null; content: string | null; startedAt: number | null }

// Keep terminal-card dismissals per tab until observed prompts supersede them.
export function useMobileNativeChatPromptDismiss({
  kind,
  content,
  startedAt,
  scopeKey,
  sessionKey,
  observing
}: {
  /** Ask and permission cards keep separate answers for the same tab. */
  kind: 'ask' | 'prompt'
  /** The card's shared dismiss key; null means no card. */
  content: string | null
  startedAt: number | null
  scopeKey: string | null
  sessionKey: string | null
  observing: boolean
}): {
  showPrompt: boolean
  collapsed: boolean
  dismissPrompt: () => void
  collapsePrompt: () => void
  expandPrompt: () => void
} {
  const storeKey = JSON.stringify([kind, scopeKey])
  const detectedByScopeRef = useRef(new Map<string | null, DetectedPrompt>())
  const observation = useMemo(() => {
    const previous = detectedByScopeRef.current.get(scopeKey)
    return previous?.sessionKey === sessionKey &&
      previous.content === content &&
      previous.startedAt === startedAt
      ? previous
      : { sessionKey, content, startedAt }
  }, [sessionKey, content, startedAt, scopeKey])
  const dismissed = useSyncExternalStore(dismissals.subscribe, () => dismissals.read(storeKey))
  const matches =
    dismissed?.sessionKey === sessionKey &&
    nativeChatPromptDismissalMatches(dismissed, content, startedAt)
  useLayoutEffect(() => {
    if (observing) {
      detectedByScopeRef.current.set(scopeKey, observation)
    }
  }, [observing, scopeKey, observation])
  useEffect(() => {
    if (observing && dismissed !== undefined && !matches) {
      dismissals.forget(storeKey)
    }
  }, [observing, dismissed, matches, storeKey])
  const record = (state: MobileNativeChatPromptDismissal['state']): void => {
    if (content !== null && detectedByScopeRef.current.get(scopeKey) === observation) {
      dismissals.write(storeKey, { sessionKey, content, startedAt, state })
    }
  }

  return {
    showPrompt: content !== null && !matches,
    collapsed: matches && dismissed?.state === 'collapsed',
    dismissPrompt: () => record('answered'),
    collapsePrompt: () => record('collapsed'),
    expandPrompt: () => dismissals.forget(storeKey)
  }
}
