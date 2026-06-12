# Lumber API Contract

The new app should expose lumber pricing through a backend endpoint. The frontend
should not call Unwrangle or Lowe's directly because API keys must stay server-side.

## Endpoint

```txt
POST /api/lumber-prices
```

Health check:

```txt
GET /health
```

## Request

```json
{
  "state": "OH",
  "zipCode": "43215",
  "materials": ["pressure-treated", "cedar", "redwood"]
}
```

Rules:

- `state` is required.
- `zipCode` must be a 5-digit ZIP code.
- If `materials` is omitted or empty, return all supported materials.
- Supported material ids are `pressure-treated`, `cedar`, and `redwood`.

## Success Response

```json
{
  "checkedAt": "2026-05-20T22:10:49.429Z",
  "details": {
    "pressureTreatedLumberPricePerBoardFoot": {
      "boardFeet": 5.33,
      "itemPrice": 8.98,
      "label": "Pressure treated",
      "pricePerBoardFoot": 1.68,
      "productUrl": "https://www.lowes.com/..."
    },
    "cedarLumberPricePerBoardFoot": {
      "boardFeet": 5.33,
      "itemPrice": 24.98,
      "label": "Cedar",
      "pricePerBoardFoot": 4.68,
      "productUrl": "https://www.lowes.com/..."
    },
    "redwoodLumberPricePerBoardFoot": {
      "boardFeet": 5.33,
      "itemPrice": 34.98,
      "label": "Redwood",
      "pricePerBoardFoot": 6.56,
      "productUrl": "https://www.lowes.com/..."
    }
  },
  "market": "43215, OH",
  "prices": {
    "pressureTreatedLumberPricePerBoardFoot": 1.68,
    "cedarLumberPricePerBoardFoot": 4.68,
    "redwoodLumberPricePerBoardFoot": 6.56
  },
  "source": "Unwrangle Lowe's API",
  "state": "OH",
  "zipCode": "43215"
}
```

The quote calculator consumes the `prices` object directly. The UI can display
`details` to show the raw item price returned by Unwrangle or Lowe's and the
converted price per board foot.

## Error Responses

Bad request:

```json
{
  "error": "state and a 5-digit zipCode are required"
}
```

Provider failure:

```json
{
  "error": "Unable to load lumber pricing",
  "message": "Unwrangle request for Pressure treated failed with 401: ..."
}
```

Recommended app behavior:

- On provider failure, the frontend or backend may fall back to a state/ZIP pricing table.
- The UI should label fallback pricing clearly as `ZIP pricing table` or `State pricing table`.
- Never silently show fallback prices as if they came from Unwrangle or Lowe's.

## Provider: Unwrangle Over Lowe's

Default provider:

```txt
LUMBER_PRICING_PROVIDER=unwrangle
```

For each material, the server calls:

```txt
https://data.unwrangle.com/api/getter/
  ?platform=lowes_detail
  &url={LOWES_PRODUCT_URL}
  &zipcode={zipCode}
  &zip_state={state}
  &api_key={UNWRANGLE_API_KEY}
```

Optional query params:

```txt
store_no={UNWRANGLE_STORE_NO}
include_source={UNWRANGLE_INCLUDE_SOURCE}
```

## Provider: Direct Lowe's API

Direct Lowe's support can be kept as a fallback provider:

```txt
LUMBER_PRICING_PROVIDER=lowes
```

The server should support either:

```txt
LOWES_PRODUCT_PRICE_URL_TEMPLATE
```

or:

```txt
LOWES_API_BASE_URL
```

The template can use:

```txt
{material}
{productId}
{state}
{zipCode}
```

API key support:

- Header by default: `LOWES_API_KEY_HEADER=Ocp-Apim-Subscription-Key`
- Query param if needed: `LOWES_API_KEY_QUERY_PARAM=api_key`

## Board-Foot Conversion

The provider returns product/item prices. The quote calculator needs dollars per
board foot.

```txt
boardFeet = thicknessInches * widthInches * lengthFeet / 12
pricePerBoardFoot = itemPrice / boardFeet
```

Default board dimensions:

```txt
LUMBER_DEFAULT_THICKNESS_INCHES=2
LUMBER_DEFAULT_WIDTH_INCHES=4
LUMBER_DEFAULT_LENGTH_FEET=8
```

Material-specific overrides should be supported:

```txt
UNWRANGLE_PRESSURE_TREATED_THICKNESS_INCHES
UNWRANGLE_PRESSURE_TREATED_WIDTH_INCHES
UNWRANGLE_PRESSURE_TREATED_LENGTH_FEET

UNWRANGLE_CEDAR_THICKNESS_INCHES
UNWRANGLE_CEDAR_WIDTH_INCHES
UNWRANGLE_CEDAR_LENGTH_FEET

UNWRANGLE_REDWOOD_THICKNESS_INCHES
UNWRANGLE_REDWOOD_WIDTH_INCHES
UNWRANGLE_REDWOOD_LENGTH_FEET
```

Equivalent `LOWES_*` dimension variables can be kept for direct Lowe's requests.

## Price Extraction

The current server checks common JSON paths:

```txt
price
salePrice
finalPrice
itemPrice
retailPrice
sellingPrice
pricing.price
pricing.salePrice
pricing.finalPrice
pricing.itemPrice
product.price
product.pricing.price
product.pricing.salePrice
data.price
data.product.price
data.product.pricing.price
```

Configurable paths:

```txt
UNWRANGLE_PRICE_JSON_PATH
UNWRANGLE_PRESSURE_TREATED_PRICE_JSON_PATH
UNWRANGLE_CEDAR_PRICE_JSON_PATH
UNWRANGLE_REDWOOD_PRICE_JSON_PATH

LOWES_PRICE_JSON_PATH
LOWES_PRESSURE_TREATED_PRICE_JSON_PATH
LOWES_CEDAR_PRICE_JSON_PATH
LOWES_REDWOOD_PRICE_JSON_PATH
```

Unwrangle price unit:

```txt
UNWRANGLE_PRICE_UNIT=cents
```

Set `UNWRANGLE_PRICE_UNIT=dollars` if the Unwrangle response already returns
dollar values.

## Fallback Pricing

Fallback values are useful for development and provider outages. The current
fallback starts with:

```txt
pressure treated = 1.15 dollars per board foot
cedar = 3.50 dollars per board foot
redwood = 5.25 dollars per board foot
```

It then applies state and ZIP-prefix multipliers. In the new app, keep fallback
pricing explicit and visible so it is not confused with live provider pricing.
