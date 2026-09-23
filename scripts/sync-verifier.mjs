import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { repoRoot, verifiedPackageAssets, verifierFiles } from './verifier-assets.mjs'

const { source } = verifiedPackageAssets()
const output = path.join(repoRoot, 'docs/public/verifier')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'malt-web-verifier.'))
try {
  for (const file of verifierFiles) fs.copyFileSync(path.join(source, file), path.join(temporary, file))
  fs.copyFileSync(path.join(output, 'authentication-v2.json'), path.join(temporary, 'authentication-v2.json'))
  const checked = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/check-verifier-wasm.mjs')], {
    env: { ...process.env, MALT_VERIFIER_ROOT: temporary }, stdio: 'inherit'
  })
  if (checked.status !== 0) throw new Error('locked malt-ts verifier failed public conformance checks')
  for (const file of verifierFiles) fs.copyFileSync(path.join(temporary, file), path.join(output, file))
} finally { fs.rmSync(temporary, { recursive: true, force: true }) }
console.log('Copied the exact verified malt-ts package assets; no WASM compilation in Web.')
