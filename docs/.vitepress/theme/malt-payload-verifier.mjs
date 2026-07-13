import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'

/**
 * Bind returned payload bytes to a ProofList that has already passed portable
 * proof verification. This function does not verify the ProofList itself.
 *
 * Raw payloads and directory manifests are checked directly against the final
 * authenticated CID. List-backed ranges are reconstructed from authenticated
 * segment CIDs before the response bytes are accepted.
 */
export async function verifyPayloadBytes({ proofList, body, contentRange = '', fetchSegment }) {
  const bytes = await asBytes(body)
  const steps = proofSteps(proofList)
  const rangeSteps = steps.filter((step) => step?.kind === 'list_range')
  const listIndexSteps = steps.filter((step) => step?.kind === 'list_index')

  if (rangeSteps.length > 1) {
    throw new Error('payload binding requires exactly one list_range step')
  }
  if (rangeSteps.length === 1) {
    return verifyListRangeBytes({
      step: rangeSteps[0],
      bytes,
      contentRange,
      fetchSegment
    })
  }
  if (listIndexSteps.length > 0) {
    throw new Error('browser payload binding does not accept list_index-only range evidence')
  }
  const target = authenticatedTarget(proofList, steps)
  if (String(contentRange || '').trim()) {
    return verifyCIDRangeBytes({ target, bytes, contentRange, fetchSegment })
  }
  await assertCIDMatchesBytes(target, bytes)
  return {
    valid: true,
    source: 'local-payload',
    mode: 'cid',
    target,
    byteLength: bytes.byteLength
  }
}

async function verifyCIDRangeBytes({ target, bytes, contentRange, fetchSegment }) {
  if (typeof fetchSegment !== 'function') {
    throw new Error('full authenticated payload fetcher is required for a raw range')
  }
  const { start, end, totalSize } = parseContentRange(contentRange)
  if (bytes.byteLength !== end - start) {
    throw new Error(
      `raw range body length ${bytes.byteLength} does not match Content-Range length ${end - start}`
    )
  }
  let fullBody
  try {
    fullBody = await asBytes(await fetchSegment(target))
  } catch (err) {
    throw new Error(`failed to fetch authenticated payload ${target}: ${errorMessage(err)}`)
  }
  await assertCIDMatchesBytes(target, fullBody)
  if (fullBody.byteLength !== totalSize) {
    throw new Error(
      `Content-Range total ${totalSize} does not match authenticated payload length ${fullBody.byteLength}`
    )
  }
  if (!equalBytes(bytes, fullBody.subarray(start, end))) {
    throw new Error('raw range body does not match authenticated payload bytes')
  }
  return {
    valid: true,
    source: 'local-payload',
    mode: 'cid-range',
    target,
    byteLength: bytes.byteLength,
    start,
    end
  }
}

export async function assertCIDMatchesBytes(rawCID, body) {
  const cid = parseCID(rawCID)
  if (cid.multihash.code !== sha256.code) {
    throw new Error(`unsupported payload multihash code ${cid.multihash.code}`)
  }
  const bytes = await asBytes(body)
  const actual = await sha256.digest(bytes)
  if (!equalBytes(actual.digest, cid.multihash.digest)) {
    throw new Error(`payload bytes do not match authenticated CID ${cid}`)
  }
  return cid.toString()
}

async function verifyListRangeBytes({ step, bytes, contentRange, fetchSegment }) {
  if (typeof fetchSegment !== 'function') {
    throw new Error('authenticated range segment fetcher is required')
  }
  const start = safeUint(step.start, 'list_range start')
  const end = safeUint(step.end, 'list_range end')
  const totalSize = safeUint(step.total_size, 'list_range total_size')
  const chunkSize = safeUint(step.chunk_size, 'list_range chunk_size')
  if (start > end) {
    throw new Error(`authenticated range start ${start} is after end ${end}`)
  }
  if (start === end) {
    throw new Error('authenticated list_range must be non-empty')
  }
  if (chunkSize === 0) {
    throw new Error('authenticated range chunk_size must be positive')
  }
  if (end > totalSize) {
    throw new Error(`authenticated range end ${end} exceeds total size ${totalSize}`)
  }
  if (bytes.byteLength !== end - start) {
    throw new Error(
      `range body length ${bytes.byteLength} does not match authenticated length ${end - start}`
    )
  }
  assertContentRange(contentRange, start, end, totalSize)

  const segmentCIDs = Array.isArray(step.segments) ? step.segments.map(cidString) : []
  if (segmentCIDs.length === 0) {
    throw new Error('authenticated list_range step does not contain segment CIDs')
  }
  if (segmentCIDs.some((segmentCID) => !segmentCID)) {
    throw new Error('authenticated list_range step contains an invalid segment CID')
  }
  const childCount = safeUint(step.child_count, 'list_range child_count')
  const expectedChildCount = Math.floor((totalSize - 1) / chunkSize) + 1
  if (childCount !== expectedChildCount) {
    throw new Error('authenticated list_range child_count conflicts with total_size and chunk_size')
  }
  const firstIndex = Math.floor(start / chunkSize)
  const lastIndex = Math.floor((end - 1) / chunkSize)
  const expectedSegmentCount = lastIndex - firstIndex + 1
  if (lastIndex >= childCount) {
    throw new Error('authenticated list_range exceeds child_count')
  }
  if (segmentCIDs.length !== expectedSegmentCount) {
    throw new Error(
      `authenticated list_range contains ${segmentCIDs.length} segments, expected ${expectedSegmentCount}`
    )
  }
  const segments = []
  for (const [index, segmentCID] of segmentCIDs.entries()) {
    let segment
    try {
      segment = await asBytes(await fetchSegment(segmentCID))
    } catch (err) {
      throw new Error(`failed to fetch authenticated segment ${index} ${segmentCID}: ${errorMessage(err)}`)
    }
    await assertCIDMatchesBytes(segmentCID, segment)
    const segmentIndex = firstIndex + index
    const expectedLength =
      segmentIndex === childCount - 1
        ? totalSize - (childCount - 1) * chunkSize
        : chunkSize
    if (segment.byteLength !== expectedLength) {
      throw new Error(
        `authenticated segment ${index} has length ${segment.byteLength}, expected ${expectedLength}`
      )
    }
    segments.push(segment)
  }

  const assembled = concatBytes(segments)
  const offset = start % chunkSize
  const limit = offset + bytes.byteLength
  if (assembled.byteLength < limit) {
    throw new Error(
      `authenticated segments provide ${assembled.byteLength} bytes from offset ${offset}, need ${limit}`
    )
  }
  if (!equalBytes(bytes, assembled.subarray(offset, limit))) {
    throw new Error('range body does not match authenticated segment bytes')
  }
  return {
    valid: true,
    source: 'local-payload',
    mode: 'list-range',
    target: cidString(step.target),
    byteLength: bytes.byteLength,
    segmentCount: segmentCIDs.length,
    start,
    end
  }
}

function assertContentRange(raw, start, end, totalSize) {
  const value = String(raw || '').trim()
  if (!value) {
    if (start !== 0 || end !== totalSize) {
      throw new Error('partial list payload is missing Content-Range')
    }
    return
  }
  const actual = parseContentRange(value)
  if (actual.start !== start || actual.end !== end || actual.totalSize !== totalSize) {
    throw new Error('Content-Range does not match authenticated list_range metadata')
  }
}

function parseContentRange(raw) {
  const value = String(raw || '').trim()
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value)
  if (!match) {
    throw new Error(`invalid Content-Range ${JSON.stringify(value)}`)
  }
  const actualStart = safeUint(Number(match[1]), 'Content-Range start')
  const actualEndInclusive = safeUint(Number(match[2]), 'Content-Range end')
  const actualTotal = safeUint(Number(match[3]), 'Content-Range total')
  if (actualEndInclusive < actualStart || actualEndInclusive >= actualTotal) {
    throw new Error('Content-Range is outside the declared payload size')
  }
  return { start: actualStart, end: actualEndInclusive + 1, totalSize: actualTotal }
}

function authenticatedTarget(proofList, steps) {
  const value = steps.length > 0 ? steps[steps.length - 1]?.target : proofList?.root
  const target = cidString(value)
  if (!target) {
    throw new Error('ProofList does not identify an authenticated payload target')
  }
  return target
}

function proofSteps(proofList) {
  if (!proofList || typeof proofList !== 'object' || !Array.isArray(proofList.steps)) {
    throw new Error('ProofList with a steps array is required for payload binding')
  }
  return proofList.steps
}

function parseCID(value) {
  const text = cidString(value)
  if (!text) {
    throw new Error('authenticated payload CID is required')
  }
  try {
    return CID.parse(text)
  } catch (err) {
    throw new Error(`invalid authenticated payload CID ${JSON.stringify(text)}: ${errorMessage(err)}`)
  }
}

function cidString(value) {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (value && typeof value === 'object' && typeof value['/'] === 'string') {
    return value['/'].trim()
  }
  return ''
}

async function asBytes(value) {
  if (value instanceof Uint8Array) {
    return value
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer())
  }
  if (typeof value === 'string') {
    return new TextEncoder().encode(value)
  }
  throw new Error('payload body bytes are required')
}

function safeUint(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
  return value
}

function concatBytes(chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

function equalBytes(left, right) {
  if (left.byteLength !== right.byteLength) {
    return false
  }
  let different = 0
  for (let index = 0; index < left.byteLength; index += 1) {
    different |= left[index] ^ right[index]
  }
  return different === 0
}

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err)
}
