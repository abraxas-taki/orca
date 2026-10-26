import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_SOURCE_CONTROL_GROUP_ORDER } from '../../../src/shared/source-control-group-order'
import type { SourceControlGroupOrder } from '../../../src/shared/ui-chrome-types'
import { sourceControlGroupOrderRead } from '../transport/settings-read-operations'
import type { RpcClient } from '../transport/rpc-client'
import type { ConnectionState } from '../transport/types'
import { buildMobileSourceControlSections, type MobileGitStatusEntry } from './mobile-git-status'

// Desktop's Source Control group order, read once per connection; mobile has no settings stream.
function useMobileSourceControlGroupOrder(
  client: RpcClient | null,
  connState: ConnectionState
): SourceControlGroupOrder {
  const [groupOrder, setGroupOrder] = useState<SourceControlGroupOrder>(
    DEFAULT_SOURCE_CONTROL_GROUP_ORDER
  )
  useEffect(() => {
    if (!client || connState !== 'connected') {
      return
    }
    let stale = false
    void sourceControlGroupOrderRead
      .request(client)
      .then((response) => {
        const read = sourceControlGroupOrderRead.interpret(response)
        if (!stale && read.accepted) {
          setGroupOrder(read.value)
        }
      })
      .catch(() => {
        // Keep the default order when the host is unreachable.
      })
    return () => {
      stale = true
    }
  }, [client, connState])
  return groupOrder
}

export function useMobileSourceControlSections<TEntry extends MobileGitStatusEntry>(
  client: RpcClient | null,
  connState: ConnectionState,
  entries: readonly TEntry[]
) {
  const groupOrder = useMobileSourceControlGroupOrder(client, connState)
  return useMemo(() => buildMobileSourceControlSections(entries, groupOrder), [entries, groupOrder])
}
