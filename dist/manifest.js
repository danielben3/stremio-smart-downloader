export const addonManifest = {
    id: 'community.stremio.smart-downloader',
    version: '1.0.0',
    name: 'Smart Downloader (כתוביות בעברית + מובייל)',
    description: 'הורדה מהירה ויציבה של סרטים וסדרות מ-Torrentio יחד עם כתוביות בעברית תואמות (Wizdom / SubDL) למובייל אנדרואיד ו-1DM.',
    logo: 'https://raw.githubusercontent.com/Stremio/stremio-addon-sdk/master/logo.png',
    background: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1920&q=80',
    resources: ['stream'],
    types: ['movie', 'series'],
    catalogs: [],
    idPrefixes: ['tt', 'kitsu'],
    behaviorHints: {
        configurable: false,
        configurationRequired: false
    }
};
