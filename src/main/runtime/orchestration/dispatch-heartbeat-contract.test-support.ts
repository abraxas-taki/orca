import { expect } from 'vitest'

export function expectHeartbeatBrief(preamble: unknown, enabled: boolean): void {
  expect(typeof preamble).toBe('string')
  if (typeof preamble !== 'string') {
    throw new Error('Expected a worker brief')
  }
  expect(preamble.includes('--type heartbeat')).toBe(enabled)
  expect(preamble.includes('Send a heartbeat every 5 minutes')).toBe(enabled)
  if (!enabled) {
    expect(preamble).not.toMatch(/heartbeat/i)
  }
  for (const command of [
    '--type worker_done',
    '--outcome succeeded',
    '--outcome failed',
    'orchestration ask --from',
    '--type escalation',
    'orchestration check --terminal'
  ]) {
    expect(preamble).toContain(command)
  }
}
