import { resolveHookCommandSourcePolicy } from './hook-command-source-policy'
import type { OrcaHooks, SetupRunPolicy } from './orca-yaml-hook-types'

export type SetupConfig = {
  source: 'yaml' | 'local' | 'both'
  command: string
  kind: 'setup' | 'default-tabs' | 'setup-and-default-tabs'
}

function getDefaultTabCommandEntries(yamlHooks: OrcaHooks | null): string[] {
  return (yamlHooks?.defaultTabs ?? [])
    .map((tab, index) => {
      const command = tab.command?.trim()
      if (!command) {
        return null
      }
      const label = tab.title ? ` ${tab.title}` : ''
      return `# defaultTabs[${index + 1}]${label}\n${command}`
    })
    .filter((entry): entry is string => entry !== null)
}

/** The orca.yaml commands a setup trust approval covers: setup plus every defaultTabs command. */
export function getSetupTrustContent(yamlHooks: OrcaHooks | null): string {
  return [yamlHooks?.scripts?.setup?.trim(), ...getDefaultTabCommandEntries(yamlHooks)]
    .filter(Boolean)
    .join('\n\n')
}

function getSetupConfigKind(
  hasSetup: boolean,
  hasDefaultTabCommands: boolean
): SetupConfig['kind'] {
  if (hasSetup && hasDefaultTabCommands) {
    return 'setup-and-default-tabs'
  }
  if (hasDefaultTabCommands) {
    return 'default-tabs'
  }
  return 'setup'
}

export function getSetupConfig(
  repo:
    | {
        hookSettings?: {
          commandSourcePolicy?: unknown
          scripts?: { setup?: string }
        }
      }
    | undefined,
  yamlHooks: OrcaHooks | null
): SetupConfig | null {
  const yamlSetup = yamlHooks?.scripts?.setup?.trim()
  const hasDefaultTabCommands = getDefaultTabCommandEntries(yamlHooks).length > 0
  const localSetup = repo?.hookSettings?.scripts?.setup?.trim()
  const sourcePolicy = resolveHookCommandSourcePolicy(repo?.hookSettings?.commandSourcePolicy, {
    hasLocalScript: Boolean(localSetup)
  })

  if (sourcePolicy === 'local-only') {
    return localSetup ? { source: 'local', command: localSetup, kind: 'setup' } : null
  }

  const yamlCommand = getSetupTrustContent(yamlHooks)
  if (sourcePolicy === 'run-both' && yamlCommand && localSetup) {
    return {
      source: 'both',
      command: `${yamlCommand}\n\n${localSetup}`,
      kind: getSetupConfigKind(true, hasDefaultTabCommands)
    }
  }

  if (yamlCommand) {
    return {
      source: 'yaml',
      command: yamlCommand,
      kind: getSetupConfigKind(Boolean(yamlSetup), hasDefaultTabCommands)
    }
  }
  return null
}

/** Null means no preset decision: nothing to run, or the repo asks every create. */
export function getDefaultSetupDecision(
  hasSetupConfig: boolean,
  setupPolicy: SetupRunPolicy
): 'run' | 'skip' | null {
  if (!hasSetupConfig || setupPolicy === 'ask') {
    return null
  }
  return setupPolicy === 'run-by-default' ? 'run' : 'skip'
}
