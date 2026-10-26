import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SOURCE_CONTROL_GROUP_ORDER } from '../../../src/shared/source-control-group-order'
import {
  sourceControlSettingsRead,
  type MobileSourceControlSettings
} from '../transport/settings-read-operations'
import type { RpcClient } from '../transport/rpc-client'
import type { ConnectionState } from '../transport/types'

const DESKTOP_DEFAULTS: MobileSourceControlSettings = {
  groupOrder: DEFAULT_SOURCE_CONTROL_GROUP_ORDER,
  compareAgainstUpstream: false,
  diffShowWhitespace: false
}

// Desktop's Source Control and diff settings, read per connection and on reload; mobile has no settings stream.
export function useMobileSourceControlSettings(
  client: RpcClient | null,
  connState: ConnectionState
): { settings: MobileSourceControlSettings; reload: () => void } {
  // Keyed by client so a new host never shows the previous host's settings while its read is in flight.
  const [read, setRead] = useState<{
    client: RpcClient
    settings: MobileSourceControlSettings
  } | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!client || connState !== 'connected') {
      return
    }
    let stale = false
    void sourceControlSettingsRead
      .request(client)
      .then((response) => {
        const reply = sourceControlSettingsRead.interpret(response)
        if (!stale && reply.accepted) {
          // An unchanged reread keeps the same object so dependents do not reload.
          setRead((prev) =>
            prev?.client === client && sameSettings(prev.settings, reply.value)
              ? prev
              : { client, settings: reply.value }
          )
        }
      })
      .catch(() => {
        // Keep desktop's defaults when the host is unreachable.
      })
    return () => {
      stale = true
    }
  }, [client, connState, revision])
  const reload = useCallback(() => setRevision((current) => current + 1), [])
  return { settings: read && read.client === client ? read.settings : DESKTOP_DEFAULTS, reload }
}

function sameSettings(a: MobileSourceControlSettings, b: MobileSourceControlSettings): boolean {
  return (
    a.compareAgainstUpstream === b.compareAgainstUpstream &&
    a.diffShowWhitespace === b.diffShowWhitespace &&
    a.groupOrder === b.groupOrder
  )
}
