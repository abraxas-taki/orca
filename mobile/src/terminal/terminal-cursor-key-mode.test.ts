import { describe, expect, it } from 'vitest'
import { applyTerminalCursorKeyMode } from './terminal-cursor-key-mode'

describe('applyTerminalCursorKeyMode', () => {
  it('sends unmodified cursor keys as SS3 while DECCKM is set', () => {
    expect(applyTerminalCursorKeyMode('\x1b[A', true)).toBe('\x1bOA')
    expect(applyTerminalCursorKeyMode('\x1b[H', true)).toBe('\x1bOH')
    expect(applyTerminalCursorKeyMode('\x1b[A', false)).toBe('\x1b[A')
  })

  it('leaves modified keys and other input alone', () => {
    expect(applyTerminalCursorKeyMode('\x1b[1;5A', true)).toBe('\x1b[1;5A')
    expect(applyTerminalCursorKeyMode('ls\x1b[A', true)).toBe('ls\x1b[A')
  })
})
