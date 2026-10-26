import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it } from 'vitest'
import { useMobileStructuredStopOffer } from './use-mobile-structured-stop-offer'

describe('useMobileStructuredStopOffer', () => {
  let renderer: ReactTestRenderer | null = null
  let offer: ReturnType<typeof useMobileStructuredStopOffer<[], string>> | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function render(send: () => Promise<string>, stopsConversation: boolean): void {
    function Harness(): null {
      offer = useMobileStructuredStopOffer({
        sessionKey: 'chat',
        turnId: null,
        isWorking: false,
        stopsConversation,
        send
      })
      return null
    }
    act(() => {
      renderer = create(createElement(Harness))
    })
  }

  it.each([true, false])(
    'offers Stop for a send in flight only where the host stops the conversation (%s)',
    async (stopsConversation) => {
      let settle!: (value: string) => void
      render(() => new Promise((resolve) => (settle = resolve)), stopsConversation)
      expect(offer?.canStop).toBe(false)

      let sent: Promise<string> | undefined
      act(() => {
        sent = offer?.send()
      })
      expect(offer?.canStop).toBe(stopsConversation)

      await act(async () => {
        settle('accepted')
        await sent
      })
      expect(offer?.canStop).toBe(false)
    }
  )
})
