# Quote Tool Handoff Package

This folder captures the pricing decisions from the current quote tool so a new
Railway-ready app can be started cleanly.

Use these files as the source of truth:

- `PRICING_SPEC.md`: what to include, what to leave out, and the pricing formulas.
- `pricing-fixtures.json`: sample inputs with expected calculated outputs.
- `lumber-api-contract.md`: request/response shape for live lumber pricing.
- `railway-env.example`: environment variables for Railway deployment.

Recommended new-app shape:

```txt
new-app/
  server/
    pricing/
      defaults.ts
      quoteCalculator.ts
      lumberPricing.ts
    routes/
      lumberPrices.ts
      quotes.ts
  web/
    ...
  docs/
    PRICING_SPEC.md
    lumber-api-contract.md
  pricing-fixtures.json
  railway-env.example
```

Keep quote math framework-independent. The UI should edit inputs and display
outputs; the server/shared pricing module should own formulas, defaults, and
rounding.
