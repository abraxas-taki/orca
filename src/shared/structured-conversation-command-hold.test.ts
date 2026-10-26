import { describe, expect, it } from 'vitest'
import { structuredConversationCommandHold } from './structured-conversation-command-hold'

describe('a conversation command held on this side', () => {
  const idle = {
    waitsInLine: false,
    agentWorking: false,
    promptPending: false,
    backgroundTasksRunning: false,
    sendPending: false
  }

  it('is held here only by a message the host does not have yet, or background work', () => {
    const inLine = { ...idle, waitsInLine: true }
    expect(
      structuredConversationCommandHold({
        ...inLine,
        agentWorking: true,
        promptPending: true
      })
    ).toBeNull()
    expect(structuredConversationCommandHold({ ...inLine, sendPending: true })).toBe('ahead')
    expect(structuredConversationCommandHold({ ...inLine, backgroundTasksRunning: true })).toBe(
      'background'
    )
  })

  it('against a host that cannot hold it, and for /clear, keeps every check in true words', () => {
    expect(structuredConversationCommandHold(idle)).toBeNull()
    expect(structuredConversationCommandHold({ ...idle, agentWorking: true })).toBe('working')
    expect(structuredConversationCommandHold({ ...idle, sendPending: true })).toBe('sending')
    expect(
      structuredConversationCommandHold({ ...idle, agentWorking: true, sendPending: true })
    ).toBe('working')
    expect(structuredConversationCommandHold({ ...idle, promptPending: true })).toBe('prompt')
  })
})
