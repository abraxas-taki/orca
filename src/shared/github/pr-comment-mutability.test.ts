import { describe, expect, it } from 'vitest'
import { isMutablePRConversationComment } from './pr-comment-mutability'

describe('isMutablePRConversationComment', () => {
  it('allows top-level conversation comments but not review threads or summaries', () => {
    expect(
      isMutablePRConversationComment({
        id: 12,
        author: 'alice',
        authorAvatarUrl: '',
        body: 'Looks good',
        createdAt: '2026-05-14T00:00:00Z',
        url: 'https://github.com/acme/widgets/pull/42#issuecomment-12'
      })
    ).toBe(true)
    expect(
      isMutablePRConversationComment({
        id: 34,
        author: 'alice',
        authorAvatarUrl: '',
        body: 'Inline note',
        createdAt: '2026-05-14T00:00:00Z',
        url: 'https://github.com/acme/widgets/pull/42#discussion_r34',
        threadId: 'thread-1',
        path: 'src/a.ts'
      })
    ).toBe(false)
    expect(
      isMutablePRConversationComment({
        id: 99,
        author: 'alice',
        authorAvatarUrl: '',
        body: 'LGTM',
        createdAt: '2026-05-14T00:00:00Z',
        url: 'https://github.com/acme/widgets/pull/42#pullrequestreview-99'
      })
    ).toBe(false)
  })
})
