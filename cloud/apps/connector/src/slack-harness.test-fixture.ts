import { createHmac, randomBytes } from 'node:crypto'
import { CONNECTOR_PATHS, type ConnectorProject } from '@orca-cloud/connector-contract'
import { vi } from 'vitest'
import { createConnectorHarness } from './connector-server-harness.test-fixture.js'
import type { SlackConfig } from './slack-config.js'
import { runSlackOperator } from './slack-operator.js'

export const SIGNING_SECRET = 'test-signing-secret'
export const TEAM = 'T1'
export const CHANNEL = 'C1'
export const BOT = 'UBOT'
export const OWNER = 'U1'
export const TEAMMATE = 'U2'

type SlackCall = { method: string; args: Record<string, unknown> }

// Stands in for slack.com/api behind the real HTTP client: records each call and answers with
// queued responses, else a plain success.
function fakeSlack() {
  const calls: SlackCall[] = []
  const queued = new Map<string, Response[]>()
  let ts = 0
  vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = url.pathname.replace('/api/', '')
    const args: Record<string, unknown> =
      typeof init?.body === 'string' ? JSON.parse(init.body) : Object.fromEntries(url.searchParams)
    calls.push({ method, args })
    const response = queued.get(method)?.shift()
    if (response) {
      return response
    }
    if (method === 'users.info') {
      return Response.json({ ok: true, user: { team_id: TEAM, profile: { display_name: 'Bob' } } })
    }
    return Response.json({ ok: true, ts: `1800000100.${String(++ts).padStart(6, '0')}` })
  })
  return {
    calls,
    respond: (method: string, ...responses: Response[]) => {
      queued.set(method, [...(queued.get(method) ?? []), ...responses])
    },
    take: (method?: string) => {
      const taken = calls.filter((call) => method === undefined || call.method === method)
      calls.length = 0
      return taken
    }
  }
}

export function project(name: string, placeId = `pl_${name}`, remote?: string): ConnectorProject {
  return { placeId, name, ...(remote ? { remote } : {}), kind: 'git', where: { kind: 'local' } }
}

export async function createSlackHarness(slack: Partial<SlackConfig> = {}) {
  const fake = fakeSlack()
  const tokenKey = randomBytes(32)
  const harness = await createConnectorHarness({
    slack: {
      signingSecret: SIGNING_SECRET,
      teamIds: new Set([TEAM]),
      paused: false,
      tokenKey,
      ...slack
    }
  })
  const edge = harness.runtime.slack
  if (!edge) {
    throw new Error('Slack edge not configured')
  }
  const operator = (...argv: string[]) =>
    runSlackOperator(argv, {
      database: harness.database,
      tokenKey,
      readSecret: async () => 'xoxb-test-token',
      now: harness.now
    })
  await operator('install', '--team', TEAM, '--bot-user', BOT)

  const signedPost = (body: string, timestamp = Math.floor(harness.now() / 1000)) =>
    harness.request('/slack/events', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-slack-request-timestamp': String(timestamp),
        'x-slack-signature': `v0=${createHmac('sha256', SIGNING_SECRET).update(`v0:${timestamp}:${body}`).digest('hex')}`
      },
      body
    })

  // One Slack post as an Events API callback; `type` lets a test send the app_mention twin.
  const message = (
    fields: {
      user?: string
      text: string
      ts: string
      thread_ts?: string
      channel?: string
    } & Record<string, unknown>,
    envelope: Record<string, unknown> = {}
  ) =>
    signedPost(
      JSON.stringify({
        type: 'event_callback',
        team_id: TEAM,
        event: {
          type: 'message',
          user: OWNER,
          channel: CHANNEL,
          channel_type: 'channel',
          ...fields
        },
        ...envelope
      })
    )

  // A connected machine of `account` listing `projects`.
  async function machineWith(
    account: string,
    projects: ConnectorProject[],
    hostName = 'build-box'
  ) {
    const machine = await harness.machine(account)
    const response = await machine.call(
      CONNECTOR_PATHS.hello,
      {
        v: 1,
        contract: 1,
        hostName,
        platform: 'darwin',
        runtime: 'desktop',
        orcaVersion: '1.4.230',
        agents: ['claude', 'codex'],
        promptKinds: ['approval'],
        features: ['answer', 'cancel', 'reply'],
        projects
      },
      'PUT'
    )
    if (response.status !== 200) {
      throw new Error(`hello failed: ${response.status}`)
    }
    return machine
  }

  const posts = async () =>
    await harness.database.query(
      'SELECT post_id, kind, body, state, next_at, slack_ts FROM connector_slack_posts ORDER BY post_id'
    )

  return { ...harness, edge, fake, tokenKey, operator, signedPost, message, machineWith, posts }
}
