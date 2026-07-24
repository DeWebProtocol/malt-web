import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'MALT',
  description: 'Arc-granularity data authentication for graph-shaped relations.',
  lang: 'en-US',
  cleanUrls: true,
  base: process.env.BASE_PATH || '/',
  head: [
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'MALT' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Arc-granularity data authentication for graph-shaped relations.'
      }
    ]
  ],
  themeConfig: {
    logo: '/visuals/malt-mark.svg',
    nav: [
      { text: 'Overview', link: '/overview' },
      { text: 'Gateway Console', link: 'https://gateway.deweb.world' },
      { text: 'Tools', link: '/tools/verify' },
      { text: 'Narrative', link: '/narrative/problem' },
      { text: 'Docs', link: '/docs/runtime' },
      { text: 'Runtime', link: '/runtime' },
      { text: 'Service', link: '/service' },
      {
        text: 'v0.0.6',
        link: 'https://github.com/DeWebProtocol/malt/releases/tag/v0.0.6'
      }
    ],
    sidebar: [
      {
        text: 'Overview',
        items: [{ text: 'MALT Design Overview', link: '/overview' }]
      },
      {
        text: 'Managed Service',
        items: [
          { text: 'Gateway Console', link: 'https://gateway.deweb.world' },
          { text: 'Service Boundary', link: '/service' }
        ]
      },
      {
        text: 'Tools',
        items: [
          { text: 'Verify Result', link: '/tools/verify' },
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
          { text: 'UnixFS Application', link: '/docs/unixfs-layout' },
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
      { icon: 'github', link: 'https://github.com/dewebprotocol/malt' },
      { icon: 'github', link: 'https://github.com/dewebprotocol/malt-web' }
    ],
    search: {
      provider: 'local'
    },
    footer: {
      message: 'MALT separates payload storage, arc authentication, and execution.',
      copyright: 'Released as project documentation for the MALT research prototype.'
    },
    editLink: {
      pattern: 'https://github.com/dewebprotocol/malt-web/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
})
