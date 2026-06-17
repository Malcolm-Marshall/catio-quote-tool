# Catio Quote Tool

React/Vite quote calculator for catio and enclosed patio projects.

## Dynamic Lumber Pricing

The catio and enclosed patio calculators update pressure-treated, cedar, and redwood board-foot prices when the state or ZIP code changes.

For catios, pressure-treated lumber drives the base material rate. The cedar and redwood catio lumber upgrades use the live price difference from pressure-treated lumber, multiplied by the catio board-foot estimate.

By default, the app uses the local fallback in `src/lib/localLumberPricing.js`. That fallback is an estimate table so the calculator works without external services.

For live retailer data through the included backend, set this browser-safe value:

```bash
VITE_LUMBER_PRICING_ENDPOINT=http://localhost:8787/api/lumber-prices
```

When a complete 5-digit ZIP code is entered, the browser sends a `POST` request to that endpoint with:

```json
{
  "state": "OH",
  "zipCode": "43215",
  "materials": ["pressure-treated", "cedar", "redwood"]
}
```

Expected response:

```json
{
  "state": "OH",
  "zipCode": "43215",
  "market": "43215, OH",
  "source": "Unwrangle Lowe's API",
  "checkedAt": "2026-05-13T16:00:00.000Z",
  "prices": {
    "pressureTreatedLumberPricePerBoardFoot": 1.18,
    "cedarLumberPricePerBoardFoot": 3.65,
    "redwoodLumberPricePerBoardFoot": 5.4
  }
}
```

Keep provider API keys on the backend. Do not expose retailer, scraping, or CME market-data keys through `VITE_` variables because Vite embeds them in browser JavaScript.

## Backend Setup

Copy `.env.example` to `.env.local` and fill in the Unwrangle values.

```bash
cp .env.example .env.local
```

Run the backend and frontend in two terminals:

```bash
npm run dev:server
npm run dev
```

The backend endpoint is:

```txt
POST http://localhost:8787/api/lumber-prices
```

## Unwrangle Setup

The default backend provider is Unwrangle. It calls Unwrangle's Lowe's product detail API with each configured Lowe's product URL and the entered ZIP code.

Server-side environment values:

```bash
LUMBER_PRICING_PROVIDER=unwrangle
UNWRANGLE_API_KEY=your-unwrangle-key
UNWRANGLE_API_URL=https://data.unwrangle.com/api/getter/
UNWRANGLE_PRICE_UNIT=cents
UNWRANGLE_PRICE_JSON_PATH=price
UNWRANGLE_PRESSURE_TREATED_PRODUCT_URL=https://www.lowes.com/pd/...
UNWRANGLE_CEDAR_PRODUCT_URL=https://www.lowes.com/pd/...
UNWRANGLE_REDWOOD_PRODUCT_URL=https://www.lowes.com/pd/...
```

Unwrangle's Lowe's detail endpoint uses:

```txt
platform=lowes_detail
url=<encoded Lowe's product URL>
zipcode=<project ZIP>
zip_state=<project state>
api_key=<your key>
```

Their docs list `price` as the current product price in cents for the Lowe's detail API, so the backend defaults to `UNWRANGLE_PRICE_UNIT=cents` and divides the value by 100 before converting to board-foot pricing.

## Direct Lowe's API Setup

Use the Lowe's API from `server.js`, not directly from this React app.

Server-side environment values:

```bash
LOWES_API_BASE_URL=https://portal.apim.lowes.com/...
LOWES_API_KEY=your-lowes-key
LOWES_API_KEY_HEADER=Ocp-Apim-Subscription-Key
LOWES_PRODUCT_PRICE_URL_TEMPLATE=https://.../{productId}?zipCode={zipCode}
LOWES_PRESSURE_TREATED_PRODUCT_ID=...
LOWES_CEDAR_PRODUCT_ID=...
LOWES_REDWOOD_PRODUCT_ID=...
```

`LOWES_PRODUCT_PRICE_URL_TEMPLATE` should be the product/price endpoint Lowe's gives you in the API portal. The server replaces these tokens:

```txt
{productId}
{zipCode}
{state}
{material}
```

If Lowe's returns price in a nested response field, set:

```bash
LOWES_PRICE_JSON_PATH=pricing.price
```

You can also set a material-specific path, such as:

```bash
LOWES_CEDAR_PRICE_JSON_PATH=data.product.pricing.salePrice
```

The backend requests the selected products for the entered ZIP code, reads the local item price, converts each board price to price per board foot, and returns the response shape shown above.

Board-foot conversion:

```txt
boardFeet = thicknessInches x widthInches x lengthFeet / 12
pricePerBoardFoot = itemPrice / boardFeet
```

Example: a nominal 2x4x8 board has `2 x 4 x 8 / 12 = 5.33` board feet. If the local API price is `$6.40`, the app should receive about `$1.20/bf`.

## Commands

```bash
npm run dev
npm run pricing:server
npm run lint
npm run build
```
