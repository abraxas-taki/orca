import { describe, expect, it } from 'vitest'
import { agentSessionFailureFact } from '../../../src/shared/agent-session-failure'
import { agentSessionFailureWords } from '../../../src/shared/agent-session-failure-words'
import { DISPATCH_REJECTED_HOST_RESTARTED } from '../../../src/shared/structured-agent-session-dispatch-rejection'
import { QUEUED_MESSAGE_PAUSED_SEND_FAILED } from '../../../src/shared/agent-session-wire'
import type { AgentSessionQueuedMessage } from '../../../src/shared/agent-session-wire'
import { mobileQueuedMessageCards } from './mobile-structured-queued-message-cards'

function returnedAs(fact: Parameters<typeof agentSessionFailureWords>[0]) {
  const { reason, rejection } = agentSessionFailureWords(fact, { surface: 'rejection' })
  return { state: 'returned' as const, returnedReason: reason, returnedRejection: rejection }
}

function draft(overrides: Partial<AgentSessionQueuedMessage> & { messageId: string }) {
  return {
    position: 1,
    body: {
      kind: 'message' as const,
      role: 'user' as const,
      blocks: [{ type: 'text' as const, text: `body of ${overrides.messageId}` }]
    },
    state: 'waiting' as const,
    ...overrides
  }
}

describe('mobileQueuedMessageCards', () => {
  it.each([
    ['Claude', 'claude auth login'],
    ['Codex', 'codex login'],
    ['Grok', 'grok login'],
    ['OpenCode', 'opencode auth login'],
    ['Pi', '/login'],
    ['OMP', 'Sign in to OMP.']
  ])('keeps %s identity and its sign-in action on returned cards', (agentName, guidance) => {
    const [card] = mobileQueuedMessageCards(
      [draft({ messageId: 'auth', ...returnedAs(agentSessionFailureFact('notSignedIn')) })],
      [],
      { agentName }
    )
    expect(card?.caption).toContain(agentName)
    expect(card?.caption).toContain(guidance)
    expect(card?.caption).not.toContain('send your message again')
    expect(card?.needsAttention).toBe(true)
  })

  it.each(['Claude', 'Codex'])(
    'keeps %s managed guidance unless a row already explains it',
    (agentName) => {
      const fact = agentSessionFailureFact('notSignedIn', { account: 'managed' })
      const drafts = [draft({ messageId: 'auth', ...returnedAs(fact) })]
      const [card] = mobileQueuedMessageCards(drafts, [], { agentName })
      expect(card?.caption).toBe(
        `This ${agentName} account isn't signed in. Sign in again in ${agentName} Accounts settings.`
      )
      const [stated] = mobileQueuedMessageCards(drafts, [], {
        agentName,
        statedFailures: [fact]
      })
      expect(stated?.caption).toBe('Your message was not sent.')
    }
  )


  it("a send-failed command card's caption names Send only when Send is there", () => {
    const failed = draft({
      messageId: 'c',
      paused: true,
      pausedReason: QUEUED_MESSAGE_PAUSED_SEND_FAILED,
      body: {
        kind: 'message',
        role: 'user',
        blocks: [{ type: 'text', text: '/compact' }],
        command: { name: 'compact' }
      }
    })
    expect(mobileQueuedMessageCards([failed], [], { agentWorking: true })[0]?.caption).toBe(
      "Couldn't send — tap Send to retry once the agent finishes"
    )
    expect(mobileQueuedMessageCards([failed], [])[0]?.caption).toBe(
      "Couldn't send — tap Send to retry"
    )
  })


  it("keeps a card's own failed send beside a plainly queued one", () => {
    const cards = mobileQueuedMessageCards(
      [
        draft({ messageId: 'a', paused: true, pausedReason: QUEUED_MESSAGE_PAUSED_SEND_FAILED }),
        draft({ messageId: 'b', position: 2 })
      ],
      []
    )
    expect(cards.map((card) => card.caption)).toEqual(["Couldn't send — tap Send to retry", null])
  })


  it('captions a reasonless pause as a plain pause, promising no release rule', () => {
    const [card] = mobileQueuedMessageCards([draft({ messageId: 'a', paused: true })], [])
    expect(card?.caption).toBe('Paused')
  })

  it("shows a returned card with the provider's own words and holds drafts behind it", () => {
    const refused = agentSessionFailureFact('providerRejected', {
      detail: { text: 'Steering is unavailable', audience: 'person' }
    })
    const cards = mobileQueuedMessageCards(
      [draft({ messageId: 'a', ...returnedAs(refused) }), draft({ messageId: 'b', position: 2 })],
      []
    )
    expect(cards[0]?.caption).toContain('Steering is unavailable')
    expect(cards[0]?.state).toBe('returned')
    expect(cards[0]?.needsAttention).toBe(true)
    expect(cards[1]?.caption).toBe('Waiting — a message ahead needs attention')
    expect(cards[1]?.needsAttention).toBe(false)
  })


  it('maps a Stop-withdrawn returned card to its own English copy', () => {
    const [card] = mobileQueuedMessageCards(
      [draft({ messageId: 'a', ...returnedAs(agentSessionFailureFact('cancelled')) })],
      []
    )
    expect(card?.caption).toBe('Stopped before it was sent')
  })

  it('reads a Stop withdrawal from the fact, whatever sentence rides beside it', () => {
    const [card] = mobileQueuedMessageCards(
      [
        draft({
          messageId: 'a',
          state: 'returned',
          returnedReason: 'This message was withdrawn before the agent started it.',
          returnedRejection: { kind: 'cancelled' }
        })
      ],
      []
    )
    expect(card?.caption).toBe('Stopped before it was sent')
  })

  it('words a host-restart returned card from its fact, as a rejected send', () => {
    const [card] = mobileQueuedMessageCards(
      [draft({ messageId: 'a', ...returnedAs(agentSessionFailureFact('hostRestarted')) })],
      []
    )
    expect(card?.caption).toBe('Orca restarted before this message was sent.')
  })

  it("keeps a provider's log-only detail off the card", () => {
    const refused = agentSessionFailureFact('providerRejected', {
      detail: { text: 'stack trace for the log', audience: 'log' }
    })
    const [card] = mobileQueuedMessageCards([draft({ messageId: 'a', ...returnedAs(refused) })], [])
    expect(card?.caption).not.toContain('stack trace')
  })

  it("words a fact kind this build cannot place with the host's sentence", () => {
    const [card] = mobileQueuedMessageCards(
      [
        draft({
          messageId: 'a',
          state: 'returned',
          returnedReason: 'Words for a kind a newer host added.',
          returnedRejection: { kind: 'laterKind' }
        })
      ],
      []
    )
    expect(card?.caption).toBe('Words for a kind a newer host added.')
  })

  it("shows the host's sentence for a fact this build cannot read all of, as the desktop card", () => {
    const reason = "Claude couldn't start. Start a new chat to continue."
    // As a newer host sends it: a known code with a reason this build doesn't know.
    const newer = {
      kind: 'startFailed',
      refusal: { code: 'agent_session_conflict', details: { reason: 'newerReason' } }
    }
    const [card] = mobileQueuedMessageCards(
      [
        draft({
          messageId: 'a',
          state: 'returned',
          returnedReason: reason,
          returnedRejection: newer
        })
      ],
      []
    )
    expect(card?.caption).toBe(reason)
  })

  it('maps the send-failed pause marker to English and an unknown marker to a plain pause', () => {
    const cards = mobileQueuedMessageCards(
      [
        draft({ messageId: 'a', paused: true, pausedReason: QUEUED_MESSAGE_PAUSED_SEND_FAILED }),
        // SAFETY: a newer host's marker this build has no vocabulary for.
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: simulates a marker from a newer host than this build's union.
        draft({ messageId: 'b', position: 2, paused: true, pausedReason: 'later_marker' as never })
      ],
      []
    )
    expect(cards.map((card) => card.caption)).toEqual([
      "Couldn't send — tap Send to retry",
      'Paused'
    ])
    expect(cards.map((card) => card.needsAttention)).toEqual([true, false])
  })

  it('never shows an internal rejection reason verbatim, even from a host that wrote no fact', () => {
    const [card] = mobileQueuedMessageCards(
      [
        draft({
          messageId: 'a',
          state: 'returned',
          returnedReason: DISPATCH_REJECTED_HOST_RESTARTED
        })
      ],
      []
    )
    expect(card?.caption).toBe('Your message was not sent.')
  })

  it("reads a card of images alone by the image's name or their count", () => {
    const images = (...paths: string[]) =>
      draft({
        messageId: paths.join(),
        body: {
          kind: 'message',
          role: 'user',
          blocks: paths.map((path) => ({ type: 'image-ref' as const, path }))
        }
      })
    const cards = mobileQueuedMessageCards(
      [images('/tmp/shot.png'), images('/tmp/orca-paste-1.png'), images('/a.png', '/b.png')],
      []
    )
    expect(cards.map((card) => card.line)).toEqual(['shot.png', 'Pasted image', '2 images'])
  })
})
