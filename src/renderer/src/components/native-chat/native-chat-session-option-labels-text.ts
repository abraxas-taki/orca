import { translate } from '@/i18n/i18n'
import {
  NATIVE_CHAT_SESSION_OPTION_COPY as COPY,
  type NativeChatSessionOptionCopyId,
  type NativeChatSessionOptionSay
} from '../../../../shared/native-chat-session-option-labels'

const PIECES: Record<NativeChatSessionOptionCopyId, (values?: { value0: string }) => string> = {
  model: () => translate('components.native-chat.composer.model', COPY.model),
  effort: () => translate('components.native-chat.composer.effort', COPY.effort),
  fastMode: () => translate('components.native-chat.composer.fastMode', COPY.fastMode),
  speed: () => translate('components.native-chat.composer.speed', COPY.speed),
  thinking: () => translate('components.native-chat.composer.thinking', COPY.thinking),
  standard: () => translate('components.native-chat.composer.optionValue.standard', COPY.standard),
  minimal: () => translate('components.native-chat.composer.optionValue.minimal', COPY.minimal),
  low: () => translate('components.native-chat.composer.optionValue.low', COPY.low),
  medium: () => translate('components.native-chat.composer.optionValue.medium', COPY.medium),
  high: () => translate('components.native-chat.composer.optionValue.high', COPY.high),
  xhigh: () => translate('components.native-chat.composer.optionValue.xhigh', COPY.xhigh),
  max: () => translate('components.native-chat.composer.optionValue.max', COPY.max),
  ultra: () => translate('components.native-chat.composer.optionValue.ultra', COPY.ultra),
  minimalShort: () =>
    translate('components.native-chat.composer.optionValueShort.minimal', COPY.minimalShort),
  mediumShort: () =>
    translate('components.native-chat.composer.optionValueShort.medium', COPY.mediumShort),
  xhighShort: () =>
    translate('components.native-chat.composer.optionValueShort.xhigh', COPY.xhighShort),
  fast: () => translate('components.native-chat.composer.optionValue.fast', COPY.fast),
  toggleOption: (values) =>
    translate('components.native-chat.composer.toggleOption', COPY.toggleOption, values),
  chooseInAgentPicker: () =>
    translate('components.native-chat.composer.chooseInAgentPicker', COPY.chooseInAgentPicker),
  setWhenSessionStarts: () =>
    translate('components.native-chat.composer.setWhenSessionStarts', COPY.setWhenSessionStarts),
  availableAfterSessionStarts: () =>
    translate(
      'components.native-chat.composer.availableAfterSessionStarts',
      COPY.availableAfterSessionStarts
    ),
  sessionOptions: () =>
    translate('components.native-chat.composer.sessionOptions', COPY.sessionOptions)
}

export const sayNativeChatSessionOptionTranslated: NativeChatSessionOptionSay = (id, values) =>
  PIECES[id](values)
