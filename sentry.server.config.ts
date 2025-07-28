// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://da82e6d85538fbb3f2f5337705c12919@o4509744324673536.ingest.us.sentry.io/4509744325853184",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable experimental features
  _experiments: {
    enableLogs: true,
    // Habilitar agregador de métricas para métricas personalizadas del servidor
    metricsAggregator: true,
  },

  // Integrations for server-side functionality
  integrations: [
    // Send console.log, console.error, and console.warn calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
  ],

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
