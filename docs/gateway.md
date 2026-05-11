# Gateway Model

The MALT gateway is a root-relative materializer and prover. It is a
performance-critical component, not a correctness authority.

## Roles

<div class="malt-flow">
  <div class="malt-flow-card">
    <strong>Writer client</strong>
    <p>Turns source-domain data into list or map semantic mutations, computes or requests a new root, and publishes that root through application policy.</p>
  </div>
  <div class="malt-flow-card">
    <strong>Gateway</strong>
    <p>Stores and materializes ArcSets, accelerates root-relative queries, and assembles ProofLists for caller-supplied roots.</p>
  </div>
  <div class="malt-flow-card">
    <strong>Reader client</strong>
    <p>Obtains a trusted root, queries any gateway, and verifies result plus ProofList locally.</p>
  </div>
</div>

## Correctness Boundary

The gateway does not:

- own authoritative heads
- choose the latest root
- guarantee freshness
- arbitrate concurrent writers
- define tenant, quota, ACL, pinning, or garbage-collection policy

The gateway does:

- materialize semantic state for explicit roots
- answer root-relative queries
- return `result + ProofList`
- support local client verification

## HTTP Shape

The current prototype exposes root-centric HTTP reads such as:

```text
GET /{root}/{path}
```

Successful file, directory, and range reads can carry verifier-facing proof
metadata in response headers:

```text
X-Malt-ProofList: <base64url(JSON ProofList)>
X-Malt-ProofList-Encoding: base64url-json
Vary: X-Malt-Proof
```

Clients that only need bytes can opt out of default proof generation with
`?proof=false` or `X-Malt-Proof: omit`.
