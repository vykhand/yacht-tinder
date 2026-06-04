/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root — a stray lockfile in the home dir otherwise confuses
  // Turbopack's root inference.
  turbopack: { root: import.meta.dirname },
  // Keep native deps (ONNX runtime / sharp) out of the webpack bundle — they must
  // load as real Node addons at runtime. This is the make-or-break config for
  // running Transformers.js inside Next.js.
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', 'sharp'],
  images: {
    // Yacht images are hotlinked from goolets' WordPress host.
    remotePatterns: [
      { protocol: 'https', hostname: 'goolets.net' },
      { protocol: 'https', hostname: '**.goolets.net' },
    ],
  },
};

export default nextConfig;
