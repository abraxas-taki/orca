// How a stepped question card picks, labels and confirms; desktop and mobile draw it differently.

/** Multi-select keeps picks in option order so the answer reads as the options do. */
export function toggleAskOption(
  picked: readonly number[],
  optionIndex: number,
  multiSelect: boolean
): number[] {
  if (picked.includes(optionIndex)) {
    return picked.filter((index) => index !== optionIndex)
  }
  return multiSelect ? [...picked, optionIndex].sort((a, b) => a - b) : [optionIndex]
}

export type AskConfirmAction = 'advance' | 'submit' | 'cancel' | 'stay'

/** Only the last question submits; an empty final Skip dismisses, while empty Enter keeps the prompt. */
export function askConfirmAction(args: {
  isLast: boolean
  anyAnswered: boolean
  fromKeyboard?: boolean
}): AskConfirmAction {
  if (!args.isLast) {
    return 'advance'
  }
  if (args.anyAnswered) {
    return 'submit'
  }
  return args.fromKeyboard ? 'stay' : 'cancel'
}

export type AskConfirmLabel = 'submit' | 'next' | 'skip'

export function askConfirmLabel(currentAnswered: boolean, isLast: boolean): AskConfirmLabel {
  if (!currentAnswered) {
    return 'skip'
  }
  return isLast ? 'submit' : 'next'
}
