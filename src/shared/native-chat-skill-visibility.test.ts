import { describe, expect, it } from 'vitest'
import type { DiscoveredSkill, SkillDiscoveryResult } from './skills'
import { isNativeChatSkillForAgent } from './native-chat-skill-visibility'

function skill(overrides: Partial<DiscoveredSkill>): DiscoveredSkill {
  return {
    id: overrides.name ?? 'skill',
    name: 'agent-browser',
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    rootPath: '/Users/test/.agents/skills',
    directoryPath: '/Users/test/.agents/skills/agent-browser',
    skillFilePath: '/Users/test/.agents/skills/agent-browser/SKILL.md',
    installed: true,
    updatedAt: null,
    ...overrides
  }
}

function discovery(owner: string | null, rootPath = '/Users/test/.agents/skills') {
  return {
    sources: [
      {
        id: 'source',
        label: 'Source',
        path: rootPath,
        sourceKind: 'home' as const,
        providers: ['agent-skills' as const],
        owner,
        exists: true
      }
    ]
  } satisfies Pick<SkillDiscoveryResult, 'sources'>
}

describe('isNativeChatSkillForAgent', () => {
  it('shows Codex-native and generic agent skills for Codex chat', () => {
    expect(isNativeChatSkillForAgent('codex', skill({ providers: ['codex'] }))).toBe(true)
    expect(isNativeChatSkillForAgent('codex', skill({ providers: ['agent-skills'] }))).toBe(true)
  })

  it('keeps Claude skills out of the Codex skill picker', () => {
    expect(isNativeChatSkillForAgent('codex', skill({ providers: ['claude'] }))).toBe(false)
  })

  it('does not enable skill autocomplete for other agents yet', () => {
    expect(isNativeChatSkillForAgent('claude', skill({ providers: ['agent-skills'] }))).toBe(false)
  })

  it('uses explicit source ownership and keeps shared roots visible', () => {
    const shared = discovery(null)
    expect(isNativeChatSkillForAgent('codex', skill({}), shared)).toBe(true)
    expect(isNativeChatSkillForAgent('claude', skill({}), shared)).toBe(true)
    expect(isNativeChatSkillForAgent('grok', skill({}), shared)).toBe(true)
  })

  it('aliases OpenClaude to Claude roots without exposing them to other agents', () => {
    const claude = discovery('claude')
    expect(isNativeChatSkillForAgent('claude', skill({}), claude)).toBe(true)
    expect(isNativeChatSkillForAgent('openclaude', skill({}), claude)).toBe(true)
    expect(isNativeChatSkillForAgent('codex', skill({}), claude)).toBe(false)
    expect(isNativeChatSkillForAgent('grok', skill({}), claude)).toBe(false)
  })

  it('shows OpenCode the Claude skill folders it reads, and not Claude plugins', () => {
    const claude = discovery('claude')
    expect(isNativeChatSkillForAgent('opencode', skill({}), claude)).toBe(true)
    expect(isNativeChatSkillForAgent('opencode2', skill({}), claude)).toBe(true)
    const plugin = { sources: [{ ...claude.sources[0], sourceKind: 'plugin' as const }] }
    expect(isNativeChatSkillForAgent('opencode2', skill({}), plugin)).toBe(false)
  })

  it('grants visibility through any contributing root, not just the dedup survivor', () => {
    const result = {
      sources: [
        {
          id: 'codex-home',
          label: 'Codex home',
          path: '/Users/test/.codex/skills',
          sourceKind: 'home' as const,
          providers: ['codex' as const],
          owner: 'codex',
          exists: true
        },
        {
          id: 'shared-home',
          label: 'Agent skills home',
          path: '/Users/test/.agents/skills',
          sourceKind: 'home' as const,
          providers: ['agent-skills' as const],
          owner: null,
          exists: true
        }
      ]
    } satisfies Pick<SkillDiscoveryResult, 'sources'>
    // Canonical dedup may list the Codex root first; shared-root reachability must still grant other agents visibility.
    const merged = skill({
      rootPath: '/Users/test/.codex/skills',
      rootPaths: ['/Users/test/.codex/skills', '/Users/test/.agents/skills']
    })
    expect(isNativeChatSkillForAgent('claude', merged, result)).toBe(true)
    expect(isNativeChatSkillForAgent('codex', merged, result)).toBe(true)
    const codexOnly = skill({
      rootPath: '/Users/test/.codex/skills',
      rootPaths: ['/Users/test/.codex/skills']
    })
    expect(isNativeChatSkillForAgent('claude', codexOnly, result)).toBe(false)
  })
})
