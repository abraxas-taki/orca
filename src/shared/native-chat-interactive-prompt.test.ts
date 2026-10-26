import { describe, expect, it } from 'vitest'
import {
  parseApprovalFromStatus,
  parseInteractivePrompt,
  resolveNativeChatInteractivePromptCard
} from './native-chat-interactive-prompt'
import type { NativeChatMessage } from './native-chat-types'

const ESC = String.fromCharCode(27)

describe('parseApprovalFromStatus', () => {
  it('returns null for non-approval envelopes', () => {
    expect(parseApprovalFromStatus(null)).toBeNull()
    expect(parseApprovalFromStatus('not json')).toBeNull()
    expect(parseApprovalFromStatus('{}')).toBeNull()
    expect(parseApprovalFromStatus(JSON.stringify({ approval: {} }))).toBeNull()
    expect(parseApprovalFromStatus(JSON.stringify({ approval: { tool: '' } }))).toBeNull()
  })

  it('builds an Allow/Deny card from { approval: { tool, summary } }', () => {
    const approval = parseApprovalFromStatus(
      JSON.stringify({ approval: { tool: 'Bash', summary: 'rm -rf build' } })
    )
    expect(approval).toEqual({
      title: 'Allow Bash?',
      detail: 'rm -rf build',
      options: [
        { label: 'Allow', send: '1' },
        { label: 'Deny', send: ESC }
      ]
    })
  })

  it('omits detail when summary is missing', () => {
    const approval = parseApprovalFromStatus(JSON.stringify({ approval: { tool: 'Edit' } }))
    expect(approval?.title).toBe('Allow Edit?')
    expect(approval?.detail).toBeUndefined()
  })

  it('omits detail for an empty or non-string summary', () => {
    for (const summary of ['', 42, null]) {
      const approval = parseApprovalFromStatus(
        JSON.stringify({ approval: { tool: 'Edit', summary } })
      )
      expect(approval?.title).toBe('Allow Edit?')
      expect(approval?.detail).toBeUndefined()
    }
  })
})

describe('parseInteractivePrompt', () => {
  it('returns a question card, with question taking precedence', () => {
    const card = parseInteractivePrompt(
      JSON.stringify({
        questions: [{ question: 'q', options: ['A'] }],
        approval: { tool: 'Bash', summary: 's' }
      })
    )
    expect(card?.kind).toBe('question')
  })

  it('returns an approval card when no question is present', () => {
    const card = parseInteractivePrompt(JSON.stringify({ approval: { tool: 'Bash' } }))
    expect(card?.kind).toBe('approval')
  })

  it('returns null when neither parses', () => {
    expect(parseInteractivePrompt(null)).toBeNull()
    expect(parseInteractivePrompt('{}')).toBeNull()
  })
})

for (const agent of ['opencode', 'opencode2']) {
  it(`${agent} approves the captured default selector with Enter`, () => {
    const card = parseApprovalFromStatus(JSON.stringify({ approval: { tool: 'shell' } }), agent)
    expect(card?.options[0].send).toBe('\r')
  })
}

describe('resolveNativeChatInteractivePromptCard', () => {
  const pendingAsk: NativeChatMessage = {
    id: 'm1',
    role: 'assistant',
    blocks: [
      {
        type: 'tool-call',
        name: 'AskUserQuestion',
        input: { questions: [{ question: 'Which path?', options: ['fast', 'safe'] }] }
      }
    ],
    timestamp: 0,
    source: 'transcript'
  }

  it('lets a live approval win over a pending transcript ask', () => {
    const resolve = (interactivePrompt: string | null) =>
      resolveNativeChatInteractivePromptCard({
        interactivePrompt,
        messages: [pendingAsk],
        transcriptSettled: true
      })
    expect(resolve(JSON.stringify({ approval: { tool: 'Bash' } }))?.kind).toBe('approval')
    expect(resolve(null)?.kind).toBe('question')
  })
})
