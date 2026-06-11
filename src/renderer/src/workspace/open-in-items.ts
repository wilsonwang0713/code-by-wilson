import type { IconName } from '../ui/icon-names'

export type OpenInGroup = 'files' | 'github'

export interface OpenInItem {
  key: string
  label: string
  icon: IconName
  group: OpenInGroup
}

/** The four targets behind the header's "Open in" dropdown. Order matters: editor/files first, then
 *  GitHub. Every target ships disabled (a placeholder) until the shell-open and git-remote plumbing
 *  lands. `icon` is constrained to the curated IconName set (imported from the JSX-free icon-names.ts so
 *  this module stays safe to typecheck under the node program), so a glyph that isn't registered in
 *  ui/icons.tsx fails the typecheck. */
export const OPEN_IN_ITEMS: OpenInItem[] = [
  { key: 'vscode', label: 'VSCode', icon: 'code', group: 'files' },
  { key: 'finder', label: 'Reveal in Finder', icon: 'folder-open', group: 'files' },
  { key: 'repo', label: 'Repository', icon: 'github', group: 'github' },
  { key: 'pr', label: 'Pull request', icon: 'git-pull-request-arrow', group: 'github' },
]

export const OPEN_IN_GROUP_LABELS: Record<OpenInGroup, string> = {
  files: 'Editor & files',
  github: 'GitHub',
}
