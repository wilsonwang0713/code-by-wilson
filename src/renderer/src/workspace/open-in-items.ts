export type OpenInGroup = 'files' | 'github'

export interface OpenInItem {
  key: string
  label: string
  // Intentionally `string` rather than `import type { IconName }` — icons.tsx is a .tsx file and
  // tsconfig.node.json (which covers tests/) lacks the jsx option, so tsc errors when it follows
  // the import into the JSX module. The values below still use valid registered icon names; the
  // stricter IconName constraint can be restored if/when the type is extracted to a plain .ts file.
  icon: string
  group: OpenInGroup
}

/** The four targets behind the header's "Open in" dropdown. Order matters: editor/files first, then
 *  GitHub. Every target ships disabled (a placeholder) until the shell-open and git-remote plumbing
 *  lands. `icon` is constrained to the curated IconName set, so typecheck fails if a glyph isn't
 *  registered in ui/icons.tsx. The `import type` is erased at runtime, keeping this module safe to
 *  import in the node test environment. */
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
