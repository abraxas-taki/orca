import { compareFolderWorkspacesForDisplay } from '../../../src/shared/sidebar-list/folder-workspace-lanes'
import type { Worktree } from './workspace-list-types'

function folderDisplayOrder(w: Worktree) {
  return {
    id: w.worktreeId,
    name: w.displayName,
    sortOrder: w.sortOrder ?? 0,
    manualOrder: w.manualOrder,
    executionHostId: w.hostId
  }
}

// Like desktop, a lane lists its folder workspaces after its worktrees, by user rank then name.
export function withFolderWorkspacesLast(worktrees: Worktree[]): Worktree[] {
  const folders = worktrees.filter((w) => w.workspaceKind === 'folder-workspace')
  if (folders.length === 0) {
    return worktrees
  }
  return [
    ...worktrees.filter((w) => w.workspaceKind !== 'folder-workspace'),
    ...folders.sort((a, b) =>
      compareFolderWorkspacesForDisplay(folderDisplayOrder(a), folderDisplayOrder(b))
    )
  ]
}
