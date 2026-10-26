import { useEffect, useState } from 'react'
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

// Desktop's Source Control and diff settings, read once per connection; mobile has no settings stream.
export function useMobileSourceControlSettings(
  client: RpcClient | null,
  connState: ConnectionState
): MobileSourceControlSettings {
  // Keyed by client so a new host never shows the previous host's settings while its read is in flight.
  const [read, setRead] = useState<{
    client: RpcClient
    settings: MobileSourceControlSettings
  } | null>(null)
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
          setRead({ client, settings: reply.value })
        }
      })
      .catch(() => {
        // Keep desktop's defaults when the host is unreachable.
      })
    return () => {
      stale = true
    }
  }, [client, connState])
  return read && read.client === client ? read.settings : DESKTOP_DEFAULTS
}
