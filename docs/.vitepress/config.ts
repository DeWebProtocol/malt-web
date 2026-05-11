import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'MALT',
  description: 'Authenticated mutable structure over immutable content-addressed storage.',
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
          'Authenticated mutable structure over immutable content-addressed storage.'
      }
    ]
  ],
  themeConfig: {
    logo: '/visuals/malt-mark.svg',
    nav: [
      { text: 'Design', link: '/overview' },
      { text: 'Concepts', link: '/concepts/roots' },
      { text: 'Gateway', link: '/gateway' },
      { text: 'Service', link: '/service' },
      { text: 'Evaluation', link: '/evaluation' }
    ],
    sidebar: [
      {
        text: 'Design',
        items: [
          { text: 'Overview', link: '/overview' },
          { text: 'Roots and Proofs', link: '/concepts/roots' },
          { text: 'List and Map Semantics', link: '/concepts/list-map' },
          { text: 'ArcTable and Commitments', link: '/concepts/arctable' }
        ]
      },
      {
        text: 'Gateway and Service',
        items: [
          { text: 'Gateway Model', link: '/gateway' },
          { text: 'Public Service Boundary', link: '/service' }
        ]
      },
      {
        text: 'Research',
        items: [{ text: 'Evaluation Plan', link: '/evaluation' }]
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
