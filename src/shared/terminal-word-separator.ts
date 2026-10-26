// xterm's default `wordSeparator`; desktop leaves the option unset unless the user customizes it.
export const TERMINAL_DEFAULT_WORD_SEPARATOR = ' ()[]{}\',"`'

// Mirror xterm's separator test so phone word selection matches desktop double-click.
export function isTerminalWordSeparator(chars: string): boolean {
  return TERMINAL_DEFAULT_WORD_SEPARATOR.includes(chars)
}
