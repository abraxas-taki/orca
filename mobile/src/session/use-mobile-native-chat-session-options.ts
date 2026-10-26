import type { AgentSessionConversationCommand } from '../../../src/shared/agent-session/agent-session-conversation-command'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import {
  getAgentSessionOptionCatalog,
  type CatalogCommandDelivery,
  type CatalogModel
} from '../../../src/shared/agent-session-option-catalog'
import type {
  NativeChatSessionOptionSettingsMutation,
  SessionOptionsSurface,
  SessionOptionDescriptor,
  SessionOptionValue
} from '../../../src/shared/native-chat-session-options'
import type { MobileNativeChatSendOutcome } from './native-chat/mobile-native-chat-send'
import {
  createNativeChatPtySessionOptions,
  type NativeChatPtySessionOptionsSurface
} from '../../../src/shared/native-chat-pty-session-options'
import {
  clearNativeChatSessionOptionCacheForTests,
  writeNativeChatSessionOptionCache
} from '../../../src/shared/native-chat-session-option-cache'
import { retireMissingModelMutation } from '../../../src/shared/native-chat-discovered-catalog-models'
import {
  createNativeChatSessionOptionRecord,
  matchNativeChatCatalogModelId
} from '../../../src/shared/native-chat-session-option-state'
import { setBoundedScopeCacheEntry } from '../../../src/shared/native-chat-scope-cache'
import { sayNativeChatSessionOptionEnglish } from '../../../src/shared/native-chat-session-option-labels'

export type MobileNativeChatSessionOptionsController = {
  optionSurface?: SessionOptionsSurface
  conversationCommands?: readonly AgentSessionConversationCommand[]
  optionPickerRequest?: { id: string; sequence: number } | null
  snapshot: SessionOptionDescriptor[]
  pendingId: string | null
  setOption: (id: string, value: SessionOptionValue) => Promise<boolean>
  invokeAction: (id: string) => Promise<boolean>
  recordCommand: (command: string) => void
}

type PendingOperation = { identity: string; id: string; token: number }
type SurfaceEntry = {
  surface: NativeChatPtySessionOptionsSurface
  canSwitchOmpModel: boolean
  /** Settles its writes unseen, so they cannot overwrite the cache of the agent that replaced it. */
  retire: () => void
}

const EMPTY_SNAPSHOT: SessionOptionDescriptor[] = []
const subscribeEmpty = (): (() => void) => () => {}
const getEmptySnapshot = (): SessionOptionDescriptor[] => EMPTY_SNAPSHOT

// Kept across remounts: a repeated hook model is not fresh evidence, and reapplying it would revert a newer pick.
const appliedReportByIdentity = new Map<string, string>()
// A tab that starts another agent starts over, as a new session there carries none of the old one's picks.
const agentByScope = new Map<string, string>()

function forgetScope(scopeKey: string, keys: Iterable<string>, drop: (key: string) => void): void {
  for (const key of keys) {
    if (key.startsWith(`${scopeKey}\0`)) {
      drop(key)
    }
  }
}

export function clearMobileSessionOptionRecordsForTests(): void {
  clearNativeChatSessionOptionCacheForTests()
  appliedReportByIdentity.clear()
  agentByScope.clear()
}

export function useMobileNativeChatSessionOptions(args: {
  agent: string | null
  scopeKey: string | null
  reportedModel: string | null
  discoveredModels?: CatalogModel[] | null
  modelSwitchCommand?: string
  dispatchCommand: (
    command: string,
    options?: { delivery?: CatalogCommandDelivery }
  ) => Promise<MobileNativeChatSendOutcome>
  onAgentPicker?: () => void
  /** Saves picks as the host's launch defaults, as desktop does. */
  writeSettings?: (mutation: NativeChatSessionOptionSettingsMutation) => void
}): MobileNativeChatSessionOptionsController {
  const { agent, scopeKey, reportedModel, discoveredModels } = args
  const identity =
    agent && scopeKey && getAgentSessionOptionCatalog(agent) ? `${scopeKey}\0${agent}` : null
  const canSwitchOmpModel = args.modelSwitchCommand === 'orca-model'
  const latest = useRef(args)
  const activeIdentityRef = useRef(identity)
  const [pending, setPending] = useState<PendingOperation | null>(null)
  // One surface per chat for this controller's life: a pick still on its way lands where the chat shows it on return.
  const [surfaces] = useState(() => new Map<string, SurfaceEntry>())
  const pendingTokenRef = useRef(0)

  useLayoutEffect(() => {
    latest.current = args
  })
  useLayoutEffect(() => {
    activeIdentityRef.current = identity
    return () => {
      activeIdentityRef.current = null
    }
  }, [identity])

  const surface = useMemo(() => {
    if (!identity || !agent || !scopeKey) {
      return null
    }
    if (agentByScope.get(scopeKey) !== agent) {
      forgetScope(scopeKey, surfaces.keys(), (key) => {
        surfaces.get(key)?.retire()
        surfaces.delete(key)
      })
      forgetScope(scopeKey, appliedReportByIdentity.keys(), (key) =>
        appliedReportByIdentity.delete(key)
      )
      writeNativeChatSessionOptionCache(scopeKey, createNativeChatSessionOptionRecord(agent))
      setBoundedScopeCacheEntry(agentByScope, scopeKey, agent)
    }
    const kept = surfaces.get(identity)
    // A changed OMP switch capability rebuilds from the cache, which holds the latest selection.
    if (kept && kept.canSwitchOmpModel === canSwitchOmpModel) {
      setBoundedScopeCacheEntry(surfaces, identity, kept)
      return kept.surface
    }
    let retired = false
    const midSession = getAgentSessionOptionCatalog(agent)?.modelApply.midSession
    // Phone-only: desktop confirms a Claude model switch on its terminal screen; the phone cannot, so it never saves one as a launch default.
    const modelSwitchUnconfirmable =
      midSession?.kind === 'command' && midSession.detectAgentInteraction !== undefined
    const created = createNativeChatPtySessionOptions({
      agent,
      scopeKey,
      mode: 'live',
      modelLabel: sayNativeChatSessionOptionEnglish('model'),
      canSwitchOmpModel,
      dispatchCommand: async (command, options) => {
        // One controller serves every tab: a queued pick must not reach the tab opened since.
        if (activeIdentityRef.current !== identity) {
          throw new Error('The chat changed before the command was sent.')
        }
        const outcome = options?.delivery
          ? await latest.current.dispatchCommand(command, { delivery: options.delivery })
          : await latest.current.dispatchCommand(command)
        if (retired) {
          throw new Error('The tab started another agent.')
        }
        // Desktop commits a pick only after the terminal confirms the write.
        if (outcome === 'rejected' || outcome === 'unknown') {
          throw new Error('The terminal did not accept the command.')
        }
      },
      onAgentPicker: () => {
        if (activeIdentityRef.current === identity) {
          latest.current.onAgentPicker?.()
        }
      },
      persistSelection: (pick) => {
        // A pick that lands after the phone moved to another host's chat must not become that host's default.
        if (
          activeIdentityRef.current === identity &&
          (!modelSwitchUnconfirmable || pick.optionId !== 'model')
        ) {
          latest.current.writeSettings?.({
            type: 'apply-picks',
            agent,
            picks: [modelSwitchUnconfirmable ? { ...pick, adoptModelAsLaunchDefault: false } : pick]
          })
        }
      }
    })
    setBoundedScopeCacheEntry(surfaces, identity, {
      surface: created,
      canSwitchOmpModel,
      retire: () => {
        retired = true
      }
    })
    return created
  }, [agent, canSwitchOmpModel, identity, scopeKey, surfaces])

  useEffect(() => {
    if (surface && discoveredModels) {
      surface.replaceModels(discoveredModels)
    }
  }, [discoveredModels, surface])

  useEffect(() => {
    const mutation =
      agent && discoveredModels ? retireMissingModelMutation(agent, discoveredModels) : null
    if (mutation) {
      latest.current.writeSettings?.(mutation)
    }
  }, [agent, discoveredModels])

  useEffect(() => {
    const catalog = agent ? getAgentSessionOptionCatalog(agent) : null
    if (!surface || !identity || !catalog || !reportedModel) {
      return
    }
    // Phone-only: desktop reads Claude's model from its terminal screen, which the phone cannot see, so Claude keeps the hook model too.
    // OMP reports exact selectors, including models absent from cached discovery.
    const matched =
      agent === 'omp'
        ? reportedModel.trim()
        : matchNativeChatCatalogModelId(
            { ...catalog, models: discoveredModels ?? catalog.models },
            reportedModel,
            { allowUnlisted: agent === 'codex' }
          )
    if (!matched || appliedReportByIdentity.get(identity) === matched) {
      return
    }
    setBoundedScopeCacheEntry(appliedReportByIdentity, identity, matched)
    surface.reportSessionOptions({ model: matched })
  }, [agent, discoveredModels, identity, reportedModel, surface])

  const snapshot = useSyncExternalStore(
    surface?.subscribe ?? subscribeEmpty,
    surface?.getSnapshot ?? getEmptySnapshot,
    surface?.getSnapshot ?? getEmptySnapshot
  )

  const track = useCallback(
    (id: string, run: (target: NativeChatPtySessionOptionsSurface) => Promise<unknown>) => {
      if (!surface || !identity) {
        return Promise.resolve(false)
      }
      pendingTokenRef.current += 1
      const token = pendingTokenRef.current
      setPending({ identity, id, token })
      return run(surface)
        .then(
          () => true,
          () => false
        )
        .finally(() => {
          setPending((current) => (current?.token === token ? null : current))
        })
    },
    [identity, surface]
  )
  const setOption = useCallback(
    (id: string, value: SessionOptionValue) => track(id, (target) => target.setOption(id, value)),
    [track]
  )
  const invokeAction = useCallback(
    (id: string) => track(id, (target) => target.invokeAction(id)),
    [track]
  )
  const recordCommand = useCallback(
    (command: string) => surface?.recordOutgoingCommand(command),
    [surface]
  )
  const pendingId = pending && pending.identity === identity ? pending.id : null

  return useMemo(
    () => ({ snapshot, pendingId, setOption, invokeAction, recordCommand }),
    [snapshot, pendingId, setOption, invokeAction, recordCommand]
  )
}
