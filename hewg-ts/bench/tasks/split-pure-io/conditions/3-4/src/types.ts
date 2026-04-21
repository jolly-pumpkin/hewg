/**
 * @hewg-module deploy/types
 */

export type ArtifactInput = {
  name: string
  version: string
  files: Array<{ path: string; content: string }>
}

export type Manifest = {
  name: string
  version: string
  hash: string
  entries: Array<{ path: string; size: number; hash: string }>
  createdAt: string
}
