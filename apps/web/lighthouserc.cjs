module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      startServerCommand: "pnpm start --port 3213",
      startServerReadyPattern: "Ready",
      startServerReadyTimeout: 60_000,
      url: ["http://127.0.0.1:3213/en", "http://127.0.0.1:3213/en/birth-nakshatra"],
      settings: {
        chromeFlags: ["--no-sandbox"],
        formFactor: "mobile",
        screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1, disabled: false },
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.7 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "first-contentful-paint": ["error", { maxNumericValue: 3000 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 5000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 500 }],
        "total-byte-weight": ["error", { maxNumericValue: 750_000 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
