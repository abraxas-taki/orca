import { useCallback, useState } from 'react'
import { structuredAgentSessionCanStop } from '../../../src/shared/structured-agent-session-stop-control'

type Send<Args extends unknown[], Result> = (...args: Args) => Promise<Result>

/** Desktop's Stop rule, counting this chat's sends still awaiting the host as sending. */
export function useMobileStructuredStopOffer(input: {
  sessionKey: string
  turnId: string | null
  isWorking: boolean
  stopsConversation: boolean
}): {
  canStop: boolean
  trackSend: <Args extends unknown[], Result>(send: Send<Args, Result>) => Send<Args, Result>
} {
  const { sessionKey } = input
  const [inFlight, setInFlight] = useState<Readonly<Record<string, number>>>({})
  const trackSend = useCallback(
    <Args extends unknown[], Result>(send: Send<Args, Result>): Send<Args, Result> =>
      async (...args) => {
        const count = (by: number) =>
          setInFlight((previous) => ({
            ...previous,
            [sessionKey]: (previous[sessionKey] ?? 0) + by
          }))
        count(1)
        try {
          return await send(...args)
        } finally {
          count(-1)
        }
      },
    [sessionKey]
  )
  return {
    canStop: structuredAgentSessionCanStop({
      turnId: input.turnId,
      isWorking: input.isWorking,
      sending: (inFlight[sessionKey] ?? 0) > 0,
      stopsConversation: input.stopsConversation
    }),
    trackSend
  }
}
