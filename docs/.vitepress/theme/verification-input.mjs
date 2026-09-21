export function verificationPairs(authentication) {
  if (!authentication || typeof authentication !== 'object') throw new Error('authentication evidence is required')
  const pairs = Object.entries(authentication).map(([name, pair]) => {
    if (!['node', 'payload', 'range'].includes(name) || pair?.request?.profile !== 'malt.authentication/1' ||
        pair?.result?.profile !== 'malt.authentication/1') throw new Error('unsupported authentication evidence')
    return { name, request: pair.request, result: pair.result }
  })
  if (!pairs.length) throw new Error('authentication evidence is empty')
  return pairs
}
