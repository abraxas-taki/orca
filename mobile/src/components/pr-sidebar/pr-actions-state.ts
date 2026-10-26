import type { PRState } from '../../../../src/shared/github/pull-request-types'
import type { GitHubPRMergeStateKind } from '../../../../src/shared/github/pull-request-merge-state'

// Match desktop: drafts offer Ready for review and Close, never Merge; merged PRs only unlink.
export type PrActionAvailability = {
  canMerge: boolean
  canMarkReady: boolean
  canClose: boolean
  canReopen: boolean
  canUnlink: boolean
}

export function resolvePrActionAvailability(state: PRState): PrActionAvailability {
  return {
    canMerge: state === 'open',
    canMarkReady: state === 'draft',
    canClose: state === 'open' || state === 'draft',
    canReopen: state === 'closed',
    canUnlink: true
  }
}

// English copy for desktop's merge-state kinds; the shared rule decides which one applies.
export const PR_MERGE_STATE_COPY: Record<GitHubPRMergeStateKind, { label: string; hint: string }> =
  {
    merged: { label: 'Merged', hint: 'This pull request is already merged' },
    closed: { label: 'Closed', hint: 'This pull request is closed' },
    draft: { label: 'Draft', hint: 'This pull request is still a draft' },
    review_required: {
      label: 'Approval required',
      hint: 'GitHub requires review approval before this pull request can merge'
    },
    changes_requested: {
      label: 'Changes requested',
      hint: 'GitHub reports requested changes on this pull request'
    },
    conflicts: { label: 'Conflicts', hint: 'GitHub reports merge conflicts' },
    merge_queue: {
      label: 'Merge when ready',
      hint: 'This base branch uses GitHub merge queue'
    },
    merge_queue_auto_merge_on: {
      label: 'Auto-merge on',
      hint: 'This base branch uses GitHub merge queue'
    },
    merge_status_unavailable: {
      label: 'Merge',
      hint: 'Merge status is unavailable for this PR'
    },
    behind: { label: 'Behind', hint: 'Update the branch before merging' },
    blocked: {
      label: 'Blocked',
      hint: 'GitHub reports this pull request is blocked'
    },
    mergeable_checks_failed: {
      label: 'Checks failed',
      hint: 'GitHub says this PR can merge, but some checks failed'
    },
    mergeable_checks_pending: {
      label: 'Checks pending',
      hint: 'GitHub says this PR can merge, but checks are still running'
    },
    mergeable_checks_passed: {
      label: 'Able to merge',
      hint: 'GitHub says this PR can merge and checks passed'
    },
    mergeable: { label: 'Able to merge', hint: 'GitHub says this PR can merge' },
    checks_passed: {
      label: 'Checks passed',
      hint: 'Checks passed. Merge eligibility will be checked again before merging.'
    },
    checking: {
      label: 'Checking',
      hint: 'GitHub is still computing this pull request merge status'
    }
  }
