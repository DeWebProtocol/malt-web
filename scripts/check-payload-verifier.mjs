import assert from 'node:assert/strict'
import fs from 'node:fs'

import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'

import {
  assertCIDMatchesBytes,
  verifyPayloadBytes
} from '../docs/.vitepress/theme/malt-payload-verifier.mjs'

const encoder = new TextEncoder()
const rootContentFixture = JSON.parse(
  fs.readFileSync(new URL('./fixtures/root-directory-content.json', import.meta.url), 'utf8')
)
const rootContentBody = Uint8Array.from(Buffer.from(rootContentFixture.body_base64, 'base64'))
const rootContentBinding = await verifyPayloadBytes({
  proofList: rootContentFixture.verification.result.prooflist,
  body: rootContentBody
})
assert.equal(rootContentBinding.target, rootContentFixture.verification.result.target)
await assert.rejects(
  verifyPayloadBytes({
    proofList: rootContentFixture.verification.result.prooflist,
    body: encoder.encode('{"entries":["tampered"]}')
  }),
  /do not match authenticated CID/
)

const rawBytes = encoder.encode('authenticated payload')
const rawCID = await cidFor(rawBytes, raw.code)
const rawProof = {
  root: { '/': rawCID },
  steps: []
}

assert.equal((await assertCIDMatchesBytes(rawCID, rawBytes)).toString(), rawCID)
assert.equal((await verifyPayloadBytes({ proofList: rawProof, body: rawBytes })).mode, 'cid')
await assert.rejects(
  verifyPayloadBytes({ proofList: rawProof, body: encoder.encode('tampered payload') }),
  /do not match authenticated CID/
)
await assert.rejects(
  verifyPayloadBytes({
    proofList: rawProof,
    body: rawBytes.subarray(0, 4),
    contentRange: `bytes 0-3/${rawBytes.byteLength}`
  }),
  /full authenticated payload fetcher is required/
)
const rawRange = await verifyPayloadBytes({
  proofList: rawProof,
  body: rawBytes.subarray(2, 9),
  contentRange: `bytes 2-8/${rawBytes.byteLength}`,
  fetchSegment: async (cid) => (cid === rawCID ? rawBytes : null)
})
assert.equal(rawRange.mode, 'cid-range')
await assert.rejects(
  verifyPayloadBytes({
    proofList: rawProof,
    body: encoder.encode('tamper!'),
    contentRange: `bytes 2-8/${rawBytes.byteLength}`,
    fetchSegment: async () => rawBytes
  }),
  /does not match authenticated payload bytes/
)
await assert.rejects(
  verifyPayloadBytes({
    proofList: rawProof,
    body: rawBytes.subarray(2, 9),
    contentRange: `bytes 2-8/${rawBytes.byteLength}`,
    fetchSegment: async () => encoder.encode('not the authenticated full payload')
  }),
  /do not match authenticated CID/
)
await assert.rejects(
  verifyPayloadBytes({
    proofList: rawProof,
    body: rawBytes.subarray(2, 9),
    contentRange: `bytes 2-8/${rawBytes.byteLength + 1}`,
    fetchSegment: async () => rawBytes
  }),
  /does not match authenticated payload length/
)

const manifestBytes = encoder.encode('{"entries":["readme.md"]}\n')
const manifestCID = await cidFor(manifestBytes, 0x300005)
const manifestProof = {
  root: { '/': rawCID },
  steps: [{ kind: 'payload_binding', target: { '/': manifestCID } }]
}
assert.equal(
  (await verifyPayloadBytes({ proofList: manifestProof, body: manifestBytes })).target,
  manifestCID
)

const segmentBodies = [
  encoder.encode('abcd'),
  encoder.encode('efgh'),
  encoder.encode('ijkl'),
  encoder.encode('mn')
]
const segmentCIDs = await Promise.all(segmentBodies.map((body) => cidFor(body, raw.code)))
const fullRangeProof = {
  root: { '/': rawCID },
  steps: [
    {
      kind: 'list_range',
      target: { '/': rawCID },
      start: 0,
      end: 14,
      total_size: 14,
      chunk_size: 4,
      child_count: 4,
      segments: segmentCIDs.map((cid) => ({ '/': cid }))
    }
  ]
}
const segments = new Map(segmentCIDs.map((cid, index) => [cid, segmentBodies[index]]))
const fullRange = await verifyPayloadBytes({
  proofList: fullRangeProof,
  body: encoder.encode('abcdefghijklmn'),
  fetchSegment: async (cid) => segments.get(cid)
})
assert.equal(fullRange.mode, 'list-range')
assert.equal(fullRange.segmentCount, 4)

const rangeProof = structuredClone(fullRangeProof)
Object.assign(rangeProof.steps[0], {
  start: 5,
  end: 11,
  segments: segmentCIDs.slice(1, 3).map((cid) => ({ '/': cid }))
})
const range = await verifyPayloadBytes({
  proofList: rangeProof,
  body: encoder.encode('fghijk'),
  contentRange: 'bytes 5-10/14',
  fetchSegment: async (cid) => segments.get(cid)
})
assert.equal(range.mode, 'list-range')
assert.equal(range.segmentCount, 2)

const wrongCoveredCount = structuredClone(rangeProof)
wrongCoveredCount.steps[0].segments.push({ '/': segmentCIDs[3] })
await assert.rejects(
  verifyPayloadBytes({
    proofList: wrongCoveredCount,
    body: encoder.encode('fghijk'),
    contentRange: 'bytes 5-10/14',
    fetchSegment: async (cid) => segments.get(cid)
  }),
  /contains 3 segments, expected 2/
)

const wrongChildCount = structuredClone(rangeProof)
wrongChildCount.steps[0].child_count = 2
await assert.rejects(
  verifyPayloadBytes({
    proofList: wrongChildCount,
    body: encoder.encode('fghijk'),
    contentRange: 'bytes 5-10/14',
    fetchSegment: async (cid) => segments.get(cid)
  }),
  /child_count conflicts/
)

const irregularSegmentBody = encoder.encode('efg')
const irregularSegmentCID = await cidFor(irregularSegmentBody, raw.code)
const irregularChunks = structuredClone(rangeProof)
irregularChunks.steps[0].segments[0] = { '/': irregularSegmentCID }
await assert.rejects(
  verifyPayloadBytes({
    proofList: irregularChunks,
    body: encoder.encode('fghijk'),
    contentRange: 'bytes 5-10/14',
    fetchSegment: async (cid) =>
      cid === irregularSegmentCID ? irregularSegmentBody : segments.get(cid)
  }),
  /authenticated segment 0 has length 3, expected 4/
)

const shortFinalBody = encoder.encode('m')
const shortFinalCID = await cidFor(shortFinalBody, raw.code)
const irregularFinal = structuredClone(fullRangeProof)
irregularFinal.steps[0].segments[3] = { '/': shortFinalCID }
await assert.rejects(
  verifyPayloadBytes({
    proofList: irregularFinal,
    body: encoder.encode('abcdefghijklmn'),
    fetchSegment: async (cid) =>
      cid === shortFinalCID ? shortFinalBody : segments.get(cid)
  }),
  /authenticated segment 3 has length 1, expected 2/
)

await assert.rejects(
  verifyPayloadBytes({
    proofList: rangeProof,
    body: encoder.encode('fghijX'),
    contentRange: 'bytes 5-10/14',
    fetchSegment: async (cid) => segments.get(cid)
  }),
  /does not match authenticated segment bytes/
)
await assert.rejects(
  verifyPayloadBytes({
    proofList: rangeProof,
    body: encoder.encode('fghijk'),
    contentRange: 'bytes 6-11/14',
    fetchSegment: async (cid) => segments.get(cid)
  }),
  /Content-Range does not match/
)
await assert.rejects(
  verifyPayloadBytes({
    proofList: rangeProof,
    body: encoder.encode('fghijk'),
    contentRange: 'bytes 5-10/14',
    fetchSegment: async (cid) =>
      cid === segmentCIDs[2] ? encoder.encode('XXXX') : segments.get(cid)
  }),
  /do not match authenticated CID/
)

async function cidFor(bytes, codec) {
  return CID.createV1(codec, await sha256.digest(bytes)).toString()
}

console.log('Browser payload binding contract passed.')
