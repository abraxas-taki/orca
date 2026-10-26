import { useCallback, useState } from 'react'
import { structuredAgentSessionCanStop } from '../../../src/shared/structured-agent-session-stop-control'

/** Desktop's Stop rule, counting this chat's sends still awaiting the host as sending. */
export function useMobileStructuredStopOffer<Args extends unknown[], Result>(input: {
  sessionKey: string
  turnId: string | null
  isWorking: boolean
  stopsConversation: boolean
  send: (...args: Args) => Promise<Result>
}): { canStop: boolean; send: (...args: Args) => Promise<Result> } {
  const { sessionKey, send } = input
  const [inFlight, setInFlight] = useState<Readonly<Record<string, number>>>({})
  const tracked = useCallback(
    async (...args: Args): Promise<Result> => {
      const count = (by: number) =>
        setInFlight((previous) => ({ ...previous, [sessionKey]: (previous[sessionKey] ?? 0) + by }))
      count(1)
      try {
        return await send(...args)
      } finally {
        count(-1)
      }
    },
    [send, sessionKey]
  )
  return {
    canStop: structuredAgentSessionCanStop({
      turnId: input.turnId,
      isWorking: input.isWorking,
      sending: (inFlight[sessionKey] ?? 0) > 0,
      stopsConversation: input.stopsConversation
    }),
    send: tracked
  }
}
