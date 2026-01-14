import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Zk-RWA-Kit',
  description: 'Privacy-preserving, just-in-time compliance for RWAs on Mantle',

  head: [
    ['meta', { name: 'theme-color', content: '#65b3ae' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'Zk-RWA-Kit Documentation' }],
    [
      'meta',
      {
        name: 'og:description',
        content:
          'Privacy-preserving, just-in-time compliance for RWAs on Mantle',
      },
    ],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/getting-started/introduction' },
      { text: 'SDK', link: '/sdk/overview' },
      { text: 'Contracts', link: '/contracts/overview' },
      {
        text: 'Examples',
        items: [
          {
            text: 'Token Transfer',
            link: 'https://zk-rwa-kit-token.vercel.app',
          },
          { text: 'Yield Vault', link: 'https://zk-rwa-kit-yield.vercel.app' },
        ],
      },
      { text: 'GitHub', link: 'https://github.com/Ghost-xDD/zk-rwa-kit' },
    ],

    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started/introduction' },
            { text: 'Quick Start', link: '/getting-started/quick-start' },
            { text: 'Architecture', link: '/getting-started/architecture' },
          ],
        },
        {
          text: 'Client SDK',
          items: [
            { text: 'Overview', link: '/sdk/overview' },
            { text: 'Installation', link: '/sdk/installation' },
            { text: 'Proof Generation', link: '/sdk/proof-generation' },
            { text: 'Proof Submission', link: '/sdk/proof-submission' },
            { text: 'Utilities', link: '/sdk/utilities' },
            { text: 'Constants & Types', link: '/sdk/constants' },
          ],
        },
        {
          text: 'Relayer API',
          items: [
            { text: 'Overview', link: '/relayer/overview' },
            { text: 'Endpoints', link: '/relayer/endpoints' },
            { text: 'Self-Hosting', link: '/relayer/self-hosting' },
          ],
        },
        {
          text: 'Smart Contracts',
          items: [
            { text: 'Overview', link: '/contracts/overview' },
            { text: 'IdentityRegistry', link: '/contracts/identity-registry' },
            { text: 'ZkOracle', link: '/contracts/zk-oracle' },
            { text: 'Compliance Middleware', link: '/contracts/compliance' },
            { text: 'Deployment', link: '/contracts/deployment' },
          ],
        },
        {
          text: 'Guides',
          items: [
            {
              text: 'Building a Compliant dApp',
              link: '/guides/compliant-dapp',
            },
            { text: 'Custom Claim Types', link: '/guides/custom-claims' },
            { text: 'Troubleshooting', link: '/guides/troubleshooting' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Ghost-xDD/zk-rwa-kit' },
    ],

    footer: {
      message: 'Built for the Mantle Global Hackathon 2025',
      copyright: 'MIT License',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/Ghost-xDD/zk-rwa-kit/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
