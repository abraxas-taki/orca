import { useSyncExternalStore, type SetStateAction } from 'react'
import type { AgentJournalSkillRef } from '../../../../../src/shared/agent-session-journal-types'
import { pickedSkillsInText } from '../../../../../src/shared/structured-agent-session-send-mutation'
import type { MobileNativeChatLaunchDraftSeed } from './use-mobile-native-chat-launch-draft-seed'

// Text and its edit revision outlive the screen, including callbacks from an older mount.
type Draft = { text: string; editGeneration: number }

const drafts = new Map<string, Draft>()
const listeners = new Set<() => void>()

// Seeded launch-context text per scope; null marks a permanent decline so a
// cleared composer never resurrects the prefill, even after leaving the screen.
export const mobileNativeChatLaunchDraftSeeds = new Map<
  string,
  MobileNativeChatLaunchDraftSeed | null
>()

// Skills picked from the menu into a draft; edits drop those the text no longer names, as deleting a desktop chip does.
const pickedSkills = new Map<string, AgentJournalSkillRef[]>()

export function recordMobileNativeChatPickedSkills(
  draftKey: string,
  skills: readonly AgentJournalSkillRef[]
): void {
  const held = pickedSkills.get(draftKey) ?? []
  const paths = new Set(held.map((skill) => skill.path))
  pickedSkills.set(draftKey, [...held, ...skills.filter((skill) => !paths.has(skill.path))])
}

// The skill token last picked into a draft while it still leads the draft, desktop's picker origin.
const skillOrigins = new Map<string, string>()

export function recordMobileNativeChatSkillPick(
  draftKey: string,
  skill: { token: string; path?: string }
): void {
  skillOrigins.set(draftKey, skill.token)
  if (skill.path) {
    recordMobileNativeChatPickedSkills(draftKey, [{ name: skill.token.slice(1), path: skill.path }])
  }
}

export function readMobileNativeChatSkillOrigin(draftKey: string): string | null {
  return skillOrigins.get(draftKey) ?? null
}

export function readMobileNativeChatPickedSkills(draftKey: string): AgentJournalSkillRef[] {
  return pickedSkills.get(draftKey) ?? []
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function writeDraft(draftKey: string, update: SetStateAction<string>, userEdit: boolean): void {
  const current = drafts.get(draftKey)
  const text = current?.text ?? ''
  const next = typeof update === 'function' ? update(text) : update
  if (next === text && !userEdit) {
    return
  }
  drafts.set(draftKey, { text: next, editGeneration: (current?.editGeneration ?? 0) + 1 })
  const picked = pickedSkills.get(draftKey)
  if (picked) {
    pickedSkills.set(draftKey, pickedSkillsInText(next, picked))
  }
  if (skillOrigins.has(draftKey) && next.split(/\s/, 1)[0] !== skillOrigins.get(draftKey)) {
    skillOrigins.delete(draftKey)
  }
  if (next === text) {
    return
  }
  for (const listener of listeners) {
    listener()
  }
}

export function setMobileNativeChatDraftText(
  draftKey: string,
  update: SetStateAction<string>
): void {
  writeDraft(draftKey, update, false)
}

export function editMobileNativeChatDraft(draftKey: string, update: SetStateAction<string>): void {
  writeDraft(draftKey, update, true)
}

export function readMobileNativeChatDraftEditGeneration(draftKey: string): number {
  return drafts.get(draftKey)?.editGeneration ?? 0
}

export function clearMobileNativeChatDraftForSend(
  draftKey: string,
  editGeneration: number,
  text: string
): void {
  const current = drafts.get(draftKey)
  if ((current?.editGeneration ?? 0) === editGeneration && (current?.text ?? '') === text) {
    setMobileNativeChatDraftText(draftKey, '')
  }
}

export function useMobileNativeChatDraft(draftKey: string | null): string {
  const read = (): string => (draftKey ? (drafts.get(draftKey)?.text ?? '') : '')
  return useSyncExternalStore(subscribe, read, read)
}

export function resetMobileNativeChatDraftStoreForTests(): void {
  drafts.clear()
  pickedSkills.clear()
  skillOrigins.clear()
  mobileNativeChatLaunchDraftSeeds.clear()
}
