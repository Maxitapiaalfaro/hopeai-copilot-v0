import {withSentryConfig} from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // 🔒 SEGURIDAD: Habilitar instrumentation hook
  experimental: {
    instrumentationHook: true,
  },

  // 🔒 SEGURIDAD: Configuración de producción
  productionBrowserSourceMaps: false, // No exponer source maps en producción

  // 🔒 SEGURIDAD: Webpack configuration para eliminar logs en producción
  webpack: (config, { dev, isServer }) => {
    // En producción, eliminar console.log del código
    if (!dev) {
      // Usar Terser para eliminar console statements
      const TerserPlugin = require('terser-webpack-plugin')

      // REEMPLAZAR los minimizers existentes con nuestra configuración
      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            compress: {
              // 🔒 Eliminar TODOS los console.* excepto console.error
              drop_console: true,
              pure_funcs: [
                'console.log',
                'console.info',
                'console.debug',
                'console.warn',
                'console.trace',
                'console.table',
                'console.dir',
                'console.dirxml',
                'console.group',
                'console.groupCollapsed',
                'console.groupEnd',
                'console.time',
                'console.timeEnd',
                'console.timeLog',
                'console.count',
                'console.countReset',
                'console.assert',
                'console.clear'
              ],
              // Eliminar código muerto
              dead_code: true,
              // Eliminar código no alcanzable
              unused: true,
            },
            mangle: {
              // Ofuscar nombres de variables
              safari10: true,
            },
            format: {
              // Eliminar comentarios
              comments: false,
            },
          },
          extractComments: false,
        })
      ];
    }

    return config
  },

  // 🔒 Headers de seguridad
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "hopeai-rh",
  project: "sentry-indigo-umbrella",

  // 🔒 SEGURIDAD: Solo mostrar logs en CI, silenciar en producción
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // 🔒 SEGURIDAD: NO subir source maps en producción (proteger código)
  widenClientFileUpload: false,

  // 🔒 SEGURIDAD: Ocultar source maps del cliente
  hideSourceMaps: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // 🔒 SEGURIDAD: Eliminar statements de logger de Sentry para reducir bundle
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors.
  automaticVercelMonitors: true,

  // 🔒 SEGURIDAD: Deshabilitar telemetría de Sentry
  telemetry: false,
});