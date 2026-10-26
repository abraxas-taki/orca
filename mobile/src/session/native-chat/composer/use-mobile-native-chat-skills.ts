import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'
import { getNativeChatAgentProfile } from '../../../../../src/shared/native-chat-agent-profiles'
import type { NativeChatSkillDiscoverySnapshot } from '../../../../../src/shared/native-chat-picker-items'
import { isNativeChatSkillForAgent } from '../../../../../src/shared/native-chat-skill-visibility'
import { salvagingArray } from '../../../../../src/shared/zod-salvage'
import type { RpcClient } from '../../../transport/rpc-client'
import { bindDeferredRpcOperation, defineRpcOperation } from '../../../transport/rpc-operation'
import { rpcResultVariant } from '../../../transport/rpc-operation-result-reader'

const skillProviders = z.array(z.enum(['codex', 'claude', 'agent-skills']))
const skillSourceKind = z.enum(['home', 'repo', 'bundled', 'plugin'])

// Rows a newer host shapes differently drop alone; the rest of the scan still lists.
const skillDiscoveryReplySchema = z.looseObject({
  skills: salvagingArray(
    z.looseObject({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      providers: skillProviders,
      sourceKind: skillSourceKind,
      sourceLabel: z.string(),
      rootPath: z.string(),
      rootPaths: z.array(z.string()).optional(),
      directoryPath: z.string(),
      skillFilePath: z.string(),
      installed: z.boolean(),
      updatedAt: z.number().nullable()
    })
  ),
  sources: salvagingArray(
    z.looseObject({
      id: z.string(),
      label: z.string(),
      path: z.string(),
      sourceKind: skillSourceKind,
      providers: skillProviders,
      owner: z.string().nullable(),
      exists: z.boolean()
    })
  )
})

type SkillDiscoveryReply = z.output<typeof skillDiscoveryReplySchema>

const skillDiscoveryRead = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'skills.discover-or-skip',
    method: 'skills.discover',
    acceptance: 'success-result-or-skip',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('skill-discovery', skillDiscoveryReplySchema)
  })
)

type Scan = { status: 'loading' | 'error' } | { status: 'ready'; reply: SkillDiscoveryReply }

const NO_SKILLS: NativeChatSkillDiscoverySnapshot = { status: 'ready', skills: [] }

/** The host scans the workspace named by id (desktop sends the pane's folder); hosts without that scan list none. */
export function useMobileNativeChatSkills(args: {
  client: RpcClient | null
  worktreeId: string
  agent: string | null
  supported: boolean
}): { nativeChatSkills: NativeChatSkillDiscoverySnapshot; loadNativeChatSkills: () => void } {
  const { client, worktreeId, agent, supported } = args
  const [scans, setScans] = useState<{ client: RpcClient | null; byKey: Map<string, Scan> }>({
    client: null,
    byKey: new Map()
  })
  const key = `${client?.getGeneration?.() ?? 0}\0${worktreeId}`
  const scan = scans.client === client ? scans.byKey.get(key) : undefined

  const loadNativeChatSkills = useCallback(() => {
    // Like desktop, a failed scan (an SSH workspace) stays failed until the connection changes.
    if (!client || !supported || scan) {
      return
    }
    const settle = (next: Scan): void =>
      setScans((current) => {
        const byKey = new Map(current.client === client ? current.byKey : [])
        byKey.set(key, next)
        return { client, byKey }
      })
    settle({ status: 'loading' })
    void skillDiscoveryRead
      .request(client, { worktreeId })
      .then((response) => {
        const accepted = skillDiscoveryRead.interpret(response)
        settle(accepted.accepted ? { status: 'ready', reply: accepted.value } : { status: 'error' })
      })
      .catch(() => settle({ status: 'error' }))
  }, [client, key, scan, supported, worktreeId])

  const nativeChatSkills = useMemo<NativeChatSkillDiscoverySnapshot>(() => {
    if (!agent || !supported || !getNativeChatAgentProfile(agent)) {
      return NO_SKILLS
    }
    if (scan?.status !== 'ready') {
      return { status: scan?.status ?? 'idle', skills: [] }
    }
    const { reply } = scan
    return {
      status: 'ready',
      skills: reply.skills.filter((skill) => isNativeChatSkillForAgent(agent, skill, reply))
    }
  }, [agent, scan, supported])

  return { nativeChatSkills, loadNativeChatSkills }
}
