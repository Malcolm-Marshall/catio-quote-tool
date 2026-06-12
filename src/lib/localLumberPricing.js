import { STATE_OPTIONS } from "../data/defaults.js";

const PRICE_FIELDS = {
  pressureTreated: "pressureTreatedLumberPricePerBoardFoot",
  cedar: "cedarLumberPricePerBoardFoot",
  redwood: "redwoodLumberPricePerBoardFoot",
};

const BASE_LUMBER_PRICES = {
  pressureTreated: 1.15,
  cedar: 3.5,
  redwood: 5.25,
};

const STATE_PRICE_MULTIPLIERS = {
  AL: 0.96,
  AK: 1.32,
  AZ: 1.08,
  AR: 0.95,
  CA: 1.22,
  CO: 1.08,
  CT: 1.14,
  DE: 1.04,
  DC: 1.16,
  FL: 1.08,
  GA: 0.98,
  HI: 1.48,
  ID: 1.02,
  IL: 1.02,
  IN: 0.98,
  IA: 0.98,
  KS: 0.99,
  KY: 0.96,
  LA: 0.98,
  ME: 1.08,
  MD: 1.08,
  MA: 1.16,
  MI: 1,
  MN: 1.02,
  MS: 0.95,
  MO: 0.97,
  MT: 1.05,
  NE: 1,
  NV: 1.12,
  NH: 1.1,
  NJ: 1.15,
  NM: 1.07,
  NY: 1.14,
  NC: 0.98,
  ND: 1.04,
  OH: 1,
  OK: 0.98,
  OR: 1.04,
  PA: 1.04,
  RI: 1.15,
  SC: 0.98,
  SD: 1.02,
  TN: 0.96,
  TX: 1.02,
  UT: 1.07,
  VT: 1.1,
  VA: 1.04,
  WA: 1.08,
  WV: 0.98,
  WI: 1,
  WY: 1.05,
};

const ZIP_PREFIX_MULTIPLIERS = {
  0: 1.08,
  1: 1.1,
  2: 1.04,
  3: 0.99,
  4: 1,
  5: 1.01,
  6: 1.01,
  7: 1.02,
  8: 1.08,
  9: 1.14,
};

const roundPrice = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const PRICING_ENDPOINT = import.meta.env?.VITE_LUMBER_PRICING_ENDPOINT;

const normalizeZipCode = (zipCode) =>
  String(zipCode ?? "")
    .replace(/\D/g, "")
    .slice(0, 5);

const normalizeState = (stateValue) => {
  const value = String(stateValue ?? "").trim();
  const upperValue = value.toUpperCase();

  return (
    STATE_OPTIONS.find((state) => state.value === upperValue) ??
    STATE_OPTIONS.find((state) => state.label.toUpperCase() === upperValue) ??
    STATE_OPTIONS.find((state) => state.value === "OH")
  );
};

const normalizeProviderDetail = (detail) => {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  const itemPrice = Number(detail.itemPrice);
  const boardFeet = Number(detail.boardFeet);
  const pricePerBoardFoot = Number(detail.pricePerBoardFoot);

  return {
    boardFeet: Number.isFinite(boardFeet) ? roundPrice(boardFeet) : null,
    itemPrice: Number.isFinite(itemPrice) ? roundPrice(itemPrice) : null,
    label: detail.label,
    pricePerBoardFoot: Number.isFinite(pricePerBoardFoot)
      ? roundPrice(pricePerBoardFoot)
      : null,
    productId: detail.productId,
    productUrl: detail.productUrl,
  };
};

const normalizeProviderDetails = (details = {}) =>
  Object.fromEntries(
    Object.entries(details)
      .map(([fieldName, detail]) => [fieldName, normalizeProviderDetail(detail)])
      .filter(([, detail]) => detail),
  );

const normalizeProviderResponse = (providerPricing, fallbackState, fallbackZipCode) => {
  const prices = {
    [PRICE_FIELDS.pressureTreated]: roundPrice(
      Number(providerPricing.prices?.[PRICE_FIELDS.pressureTreated]),
    ),
    [PRICE_FIELDS.cedar]: roundPrice(Number(providerPricing.prices?.[PRICE_FIELDS.cedar])),
    [PRICE_FIELDS.redwood]: roundPrice(
      Number(providerPricing.prices?.[PRICE_FIELDS.redwood]),
    ),
  };

  return {
    checkedAt: providerPricing.checkedAt ?? new Date().toISOString(),
    details: normalizeProviderDetails(providerPricing.details),
    market: providerPricing.market ?? fallbackState.label,
    source: providerPricing.source ?? "External lumber pricing endpoint",
    state: providerPricing.state ?? fallbackState.value,
    zipCode: normalizeZipCode(providerPricing.zipCode ?? fallbackZipCode),
    prices,
  };
};

const hasCompletePrices = (pricing) =>
  Object.values(pricing.prices).every((price) => Number.isFinite(price) && price > 0);

async function getExternalLumberPrices({ state, zipCode }) {
  if (!PRICING_ENDPOINT) {
    return null;
  }

  const response = await fetch(PRICING_ENDPOINT, {
    body: JSON.stringify({
      materials: ["pressure-treated", "cedar", "redwood"],
      state,
      zipCode,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Lumber pricing request failed with ${response.status}`);
  }

  return response.json();
}

function getFallbackLumberPrices(state, normalizedZipCode) {
  const zipMultiplier =
    normalizedZipCode.length === 5
      ? ZIP_PREFIX_MULTIPLIERS[normalizedZipCode[0]] ?? 1
      : 1;
  const multiplier = (STATE_PRICE_MULTIPLIERS[state.value] ?? 1) * zipMultiplier;

  return {
    checkedAt: new Date().toISOString(),
    details: {},
    market: state.label,
    source: normalizedZipCode.length === 5 ? "ZIP pricing table" : "State pricing table",
    state: state.value,
    zipCode: normalizedZipCode,
    prices: {
      [PRICE_FIELDS.pressureTreated]: roundPrice(
        BASE_LUMBER_PRICES.pressureTreated * multiplier,
      ),
      [PRICE_FIELDS.cedar]: roundPrice(BASE_LUMBER_PRICES.cedar * multiplier),
      [PRICE_FIELDS.redwood]: roundPrice(BASE_LUMBER_PRICES.redwood * multiplier),
    },
  };
}

export async function getLocalLumberPricesForLocation({ state: stateValue, zipCode } = {}) {
  const state = normalizeState(stateValue);
  const normalizedZipCode = normalizeZipCode(zipCode);

  try {
    const externalPricing =
      normalizedZipCode.length === 5
        ? await getExternalLumberPrices({
            state: state.value,
            zipCode: normalizedZipCode,
          })
        : null;

    if (externalPricing) {
      const normalizedExternalPricing = normalizeProviderResponse(
        externalPricing,
        state,
        normalizedZipCode,
      );

      if (hasCompletePrices(normalizedExternalPricing)) {
        return normalizedExternalPricing;
      }
    }
  } catch {
    return getFallbackLumberPrices(state, normalizedZipCode);
  }

  await Promise.resolve();

  return getFallbackLumberPrices(state, normalizedZipCode);
}
