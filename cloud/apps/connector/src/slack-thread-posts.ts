import type { CloudDatabase, SqlRow } from '@orca-cloud/cloud-database'
import { ConnectorDeliveryResultSchema } from '@orca-cloud/connector-contract'
import type { SlackPlace, SlackPosts } from './slack-posts.js'
import { escapeSlackText, slackText } from './slack-text.js'

// A turn's last message is posted only if the agent hasn't replied itself by then.
const FALLBACK_DELAY_MS = 5_000

type BoundThread = SlackPlace & { hostName: string }

// A Slack thread bound to this host, with its machine's name; null for anyone else's conversation.
async function boundThread(
  transaction: CloudDatabase,
  hostId: string,
  externalId: string
): Promise<(BoundThread & { row: SqlRow }) | null> {
  const [row] = await transaction.query(
    `SELECT t.*, h.host_name FROM connector_threads t
     JOIN connector_hosts h ON h.host_id = t.host_id
     WHERE t.external_id = ? AND t.host_id = ?`,
    [externalId, hostId]
  )
  return row
    ? {
        teamId: String(row.team_id),
        channelId: String(row.channel_id),
        threadTs: String(row.thread_ts),
        hostName: String(row.host_name),
        row
      }
    : null
}

// The status message is a projection of the thread's current state: refreshing twice is a no-op.
export async function refreshSlackStatus(
  transaction: CloudDatabase,
  posts: SlackPosts,
  hostId: string,
  externalId: string
): Promise<void> {
  // Serialized per conversation, so a refresh that read older state can't land after a newer one.
  await transaction.lockQuotaScope(`orca-connector-slack-status:${externalId}`)
  const thread = await boundThread(transaction, hostId, externalId)
  if (!thread) {
    return
  }
  const [latest] = await transaction.query(
    `SELECT state, result FROM connector_inbox
     WHERE host_id = ? AND external_id = ? AND kind IN ('start', 'send')
     ORDER BY seq DESC LIMIT 1`,
    [hostId, externalId]
  )
  await posts.setStatus(transaction, {
    ...thread,
    postId: `status:${externalId}`,
    text: statusText(thread.row, latest, thread.hostName)
  })
}

// A turn's reply and its fallback decide under one lock, so exactly one of them wins.
async function lockTurn(transaction: CloudDatabase, turnKey: string): Promise<void> {
  await transaction.lockQuotaScope(`orca-connector-slack-turn:${turnKey}`)
}

// From each turn-ended event itself, so every ended turn gets its own fallback.
export async function queueTurnFallback(
  transaction: CloudDatabase,
  posts: SlackPosts,
  hostId: string,
  turn: { externalId: string; turnId: number; lastAssistantMessage: string }
): Promise<void> {
  const thread = await boundThread(transaction, hostId, turn.externalId)
  if (!thread || turn.lastAssistantMessage.trim().length === 0) {
    return
  }
  const turnKey = `${turn.externalId}:${turn.turnId}`
  await lockTurn(transaction, turnKey)
  if (await posts.hasReplyForTurn(transaction, turnKey)) {
    return
  }
  await posts.queue(transaction, {
    ...thread,
    postId: `fallback:${turnKey}`,
    kind: 'message',
    body: { text: escapeSlackText(turn.lastAssistantMessage) },
    turnKey,
    delayMs: FALLBACK_DELAY_MS
  })
}

// The agent's own reply (orca slack reply); retries with one replyId post once. Null when the
// thread isn't this host's.
export async function queueAgentReply(
  transaction: CloudDatabase,
  posts: SlackPosts,
  hostId: string,
  reply: { replyId: string; externalId: string; turnId: number; text: string }
): Promise<{ state: string; slackTs: string | null } | null> {
  const thread = await boundThread(transaction, hostId, reply.externalId)
  if (!thread) {
    return null
  }
  const postId = `reply:${hostId}:${reply.replyId}`
  const turnKey = `${reply.externalId}:${reply.turnId}`
  await lockTurn(transaction, turnKey)
  await posts.queue(transaction, {
    ...thread,
    postId,
    kind: 'message',
    body: { text: escapeSlackText(reply.text) },
    turnKey
  })
  await posts.cancelQueued(transaction, `fallback:${turnKey}`)
  return await posts.find(transaction, postId)
}

function statusText(thread: SqlRow, latest: SqlRow | undefined, hostName: string): string {
  const result =
    latest?.state === 'done'
      ? ConnectorDeliveryResultSchema.safeParse(JSON.parse(String(latest.result))).data
      : undefined
  // The newest message never arriving outranks whatever the last turn left showing.
  if (latest?.state === 'expired' || result?.outcome === 'expired') {
    return slackText.status.offline(String(thread.owner_user_id), hostName)
  }
  if (thread.pending_prompt !== null) {
    return slackText.status.needsAnswer(hostName)
  }
  if (thread.turn_state === 'working') {
    return slackText.status.working(hostName)
  }
  if (latest?.state === 'pending' || latest?.state === 'held' || latest?.state === 'leased') {
    return slackText.status.waiting(hostName)
  }
  switch (result?.outcome) {
    case 'refused':
      return slackText.status.refused(hostName, result.reason)
    case 'unsupported':
      return slackText.status.refused(hostName, 'unsupported')
    case 'unknown':
      return slackText.status.unknown
  }
  if (thread.turn_state === 'unverifiable') {
    return slackText.status.noUpdate
  }
  if (thread.turn_state === 'ended') {
    return slackText.status.done(hostName)
  }
  return latest ? slackText.status.working(hostName) : slackText.status.waiting(hostName)
}
