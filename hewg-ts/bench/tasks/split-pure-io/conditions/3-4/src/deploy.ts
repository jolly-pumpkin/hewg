/**
 * @hewg-module deploy/deploy
 */

import { writeFileSync, mkdirSync } from "node:fs"
import type { ArtifactInput, Manifest } from "./types.ts"
import { hashString } from "./hash.ts"

/**
 * Deploy an artifact: validate input, compute manifest, write files to dist/.
 * @param input - the artifact to deploy
 * @returns the generated manifest
 * @effects fs.write
 * @cap out fs.write prefix="./dist/"
 */
export function deployArtifact(input: ArtifactInput): Manifest {
  // Validation
  if (!input.name || !input.version) {
    throw new Error("Artifact must have a name and version")
  }
  if (input.files.length === 0) {
    throw new Error("Artifact must have at least one file")
  }

  // Compute manifest (pure logic)
  const entries = input.files.map((f) => ({
    path: f.path,
    size: f.content.length,
    hash: hashString(f.content),
  }))
  const manifestHash = hashString(
    entries.map((e) => e.hash).join(""),
  )
  const manifest: Manifest = {
    name: input.name,
    version: input.version,
    hash: manifestHash,
    entries,
    createdAt: new Date().toISOString(),
  }

  // IO: write files
  const outDir = `./dist/${input.name}/${input.version}`
  mkdirSync(outDir, { recursive: true })
  for (const f of input.files) {
    writeFileSync(`${outDir}/${f.path}`, f.content)
  }
  writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2))

  return manifest
}
