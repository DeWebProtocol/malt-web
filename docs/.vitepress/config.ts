import { defineConfig } from 'vitepress'

const appFallbackRedirectScript = `<script>
;(() => {
  const storageKey = 'malt-app-fallback-path'
  const pathname = window.location.pathname
  const appMarker = '/app/'
  const appIndex = pathname.indexOf(appMarker)
  if (appIndex === -1) {
    return
  }
  const appPath = pathname.slice(0, appIndex + '/app'.length) || '/app'
  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        pathname,
        search: window.location.search,
        hash: window.location.hash
      })
    )
  } catch {}
  window.location.replace(appPath)
})()
</script>`

export default defineConfig({
  title: 'MALT',
  description: 'Authenticated mutable structure over immutable content-addressed storage.',
  lang: 'en-US',
  cleanUrls: true,
  base: process.env.BASE_PATH || '/',
  transformHtml(code, id) {
    if (!id.endsWith('404.html')) {
      return
    }
    return code.replace('</head>', `${appFallbackRedirectScript}\n  </head>`)
  },
  head: [
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'MALT' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Authenticated mutable structure over immutable content-addressed storage.'
      }
    ]
  ],
  themeConfig: {
    logo: '/visuals/malt-mark.svg',
    nav: [
      { text: 'Overview', link: '/overview' },
      { text: 'App', link: '/app' },
      { text: 'Tools', link: '/tools/verify' },
      { text: 'Narrative', link: '/narrative/problem' },
      { text: 'Docs', link: '/docs/runtime' },
      { text: 'Runtime', link: '/runtime' },
      { text: 'Service', link: '/service' }
    ],
    sidebar: [
      {
        text: 'Overview',
        items: [{ text: 'MALT Design Overview', link: '/overview' }]
      },
      {
        text: 'App',
        items: [{ text: 'Browser App', link: '/app' }]
      },
      {
        text: 'Tools',
        items: [
          { text: 'Verify ProofList', link: '/tools/verify' },
          { text: 'Resolve Content', link: '/tools/resolve' }
        ]
      },
      {
        text: 'Research Narrative',
        items: [
          { text: 'Problem', link: '/narrative/problem' },
          { text: 'Abstraction', link: '/narrative/abstraction' },
          { text: 'System Design', link: '/narrative/system-design' },
          { text: 'Evaluation Story', link: '/narrative/evaluation-story' }
        ]
      },
      {
        text: 'Technical Docs',
        items: [
          { text: 'Runtime and Prototype', link: '/docs/runtime' },
          { text: 'HTTP API', link: '/docs/api' },
          { text: 'ProofLists', link: '/docs/prooflists' },
          { text: 'UnixFS Layout', link: '/docs/unixfs-layout' },
          { text: 'Benchmark Protocol', link: '/docs/evaluation' }
        ]
      },
      {
        text: 'Concepts',
        items: [
          { text: 'Roots and Proofs', link: '/concepts/roots' },
          { text: 'List and Map Semantics', link: '/concepts/list-map' },
          { text: 'ArcTable and Commitments', link: '/concepts/arctable' }
        ]
      },
      {
        text: 'Runtime and Service',
        items: [
          { text: 'Server Runtime Model', link: '/runtime' },
          { text: 'Public Service Boundary', link: '/service' }
        ]
      },
      {
        text: 'Evaluation',
        items: [
          { text: 'Evaluation Bridge', link: '/evaluation' },
          { text: 'Evaluation Story', link: '/narrative/evaluation-story' },
          { text: 'Benchmark Protocol', link: '/docs/evaluation' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dewebprotocol/malt-web' }
    ],
    search: {
      provider: 'local'
    },
    footer: {
      message: 'MALT separates payload identity from authenticated structure.',
      copyright: 'Released as project documentation for the MALT research prototype.'
    },
    editLink: {
      pattern: 'https://github.com/dewebprotocol/malt-web/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
})
