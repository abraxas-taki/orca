import { describe, expect, it } from 'vitest'
import { resolvePrActionAvailability } from './pr-actions-state'

describe('resolvePrActionAvailability', () => {
  it('offers Ready for review instead of Merge on drafts, like desktop', () => {
    expect(resolvePrActionAvailability('draft')).toMatchObject({
      canMerge: false,
      canMarkReady: true,
      canClose: true
    })
    expect(resolvePrActionAvailability('open')).toMatchObject({
      canMerge: true,
      canMarkReady: false,
      canClose: true
    })
  })
})
