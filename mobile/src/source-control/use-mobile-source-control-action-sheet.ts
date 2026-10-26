import { useMemo } from 'react'
import { buildMobileSourceControlActions } from './mobile-source-control-actions'
import type { ActionSheetAction } from '../components/ActionSheetModal'
import { SOURCE_CONTROL_ACTION_ICONS } from './mobile-source-control-screen-state'
import type { MobileSourceControlState } from './use-mobile-source-control-state'
import {
  buildMobileSourceControlDecisionInputs,
  type MobileSourceControlReviewInputs
} from './mobile-source-control-primary-action'

export function useMobileSourceControlActionSheet(
  state: MobileSourceControlState,
  review: MobileSourceControlReviewInputs
): ActionSheetAction[] {
  const {
    primaryActionArgs,
    status,
    branchCompareState,
    upstreamKnown,
    busyAction,
    openingPath,
    openingBranchPath,
    runActionSheetCommit,
    runActionSheetCommitSequence,
    runActionSheetCommitSync,
    runActionSheetGitSequence,
    runActionSheetGitSync,
    runActionSheetRebase,
    createPr,
    openBranchPicker,
    openHistory
  } = state

  return useMemo<ActionSheetAction[]>(
    () =>
      buildMobileSourceControlActions({
        decision: buildMobileSourceControlDecisionInputs({ ...primaryActionArgs, review }),
        conflictOperation: status?.conflictOperation,
        // Desktop rebases onto the effective base, not an upstream compare base; the runner resolves the same ref.
        rebaseBaseRef:
          branchCompareState.kind === 'ready' || branchCompareState.kind === 'error'
            ? (branchCompareState.effectiveBaseRef ?? null)
            : null,
        busyAction,
        openingPath,
        openingBranchPath,
        // Create intent may publish or push before review creation.
        prAvailable: upstreamKnown,
        prHint: upstreamKnown ? undefined : 'Checking branch status...',
        handlers: {
          commit: () => void runActionSheetCommit(),
          commitPush: (forceWithLease) =>
            void runActionSheetCommitSequence('commit-push', [
              forceWithLease
                ? { method: 'git.push', params: { forceWithLease: true } }
                : { method: 'git.push' }
            ]),
          commitSync: () => void runActionSheetCommitSync(),
          push: () => void runActionSheetGitSequence('push', [{ method: 'git.push' }]),
          forcePush: () =>
            void runActionSheetGitSequence('force-push', [
              { method: 'git.push', params: { forceWithLease: true } }
            ]),
          pull: () => void runActionSheetGitSequence('pull', [{ method: 'git.pull' }]),
          sync: () => void runActionSheetGitSync(),
          fetch: () => void runActionSheetGitSequence('fetch', [{ method: 'git.fetch' }]),
          publish: () =>
            void runActionSheetGitSequence('publish', [
              { method: 'git.push', params: { publish: true } }
            ]),
          fastForward: () =>
            void runActionSheetGitSequence('fast-forward', [{ method: 'git.fastForward' }]),
          rebase: () => void runActionSheetRebase(),
          createPr: () => void createPr(false),
          pushAndCreatePr: () => void createPr(true),
          checkout: () => void openBranchPicker(),
          history: () => void openHistory()
        }
      }).map((action) => ({ ...action, icon: SOURCE_CONTROL_ACTION_ICONS[action.iconKey] })),
    [
      branchCompareState,
      busyAction,
      createPr,
      openBranchPicker,
      openHistory,
      openingBranchPath,
      openingPath,
      primaryActionArgs,
      review,
      runActionSheetCommit,
      runActionSheetCommitSequence,
      runActionSheetCommitSync,
      runActionSheetGitSequence,
      runActionSheetGitSync,
      runActionSheetRebase,
      status?.conflictOperation,
      upstreamKnown
    ]
  )
}
