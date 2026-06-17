import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const MATERIALS = {
  "pressure-treated": {
    envPrefix: "LOWES_PRESSURE_TREATED",
    label: "Pressure treated",
    responseField: "pressureTreatedLumberPricePerBoardFoot",
    unwrangleEnvPrefix: "UNWRANGLE_PRESSURE_TREATED",
  },
  cedar: {
    envPrefix: "LOWES_CEDAR",
    label: "Cedar",
    responseField: "cedarLumberPricePerBoardFoot",
    unwrangleEnvPrefix: "UNWRANGLE_CEDAR",
  },
  redwood: {
    envPrefix: "LOWES_REDWOOD",
    label: "Redwood",
    responseField: "redwoodLumberPricePerBoardFoot",
    unwrangleEnvPrefix: "UNWRANGLE_REDWOOD",
  },
};

const DEFAULT_PRICE_PATHS = [
  "price",
  "salePrice",
  "finalPrice",
  "itemPrice",
  "retailPrice",
  "sellingPrice",
  "pricing.price",
  "pricing.salePrice",
  "pricing.finalPrice",
  "pricing.itemPrice",
  "product.price",
  "product.pricing.price",
  "product.pricing.salePrice",
  "data.price",
  "data.product.price",
  "data.product.pricing.price",
];

function loadEnvFile(fileName) {
  const filePath = resolve(fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmedLine.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, equalsIndex).trim();
    const value = trimmedLine
      .slice(equalsIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const distRoot = resolve("dist");

function getContentType(filePath) {
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function resolveStaticPath(pathname) {
  const safePath = resolve(distRoot, "." + pathname);

  if (!safePath.startsWith(distRoot + "/") && safePath !== distRoot) {
    return null;
  }

  return safePath;
}

function serveStaticAsset(request, response) {
  const url = new URL(request.url, "http://localhost");
  let pathname = url.pathname;

  if (pathname === "/") {
    pathname = "/index.html";
  }

  let filePath = resolveStaticPath(pathname);

  if (!filePath || !existsSync(filePath)) {
    if (pathname.includes(".") && pathname !== "/") {
      return false;
    }

    filePath = resolve(distRoot, "index.html");
  }

  if (!existsSync(filePath)) {
    return false;
  }

  response.writeHead(200, {
    "Content-Type": getContentType(filePath),
  });
  response.end(readFileSync(filePath));
  return true;
}

const port = Number(process.env.LUMBER_PRICING_PORT ?? process.env.PORT ?? 8787);
const host = process.env.LUMBER_PRICING_HOST ?? "127.0.0.1";
const pricingProvider = process.env.LUMBER_PRICING_PROVIDER ?? "unwrangle";
const allowedOrigins = (process.env.LUMBER_PRICING_ALLOWED_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const roundPrice = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function getCorsHeaders(origin) {
  const allowOrigin =
    allowedOrigins.includes("*") || !origin || allowedOrigins.includes(origin)
      ? origin || "*"
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": allowOrigin,
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function sendJson(response, statusCode, body, origin) {
  response.writeHead(statusCode, getCorsHeaders(origin));
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        rejectBody(new Error("Request body is too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch {
        rejectBody(new Error("Request body must be valid JSON"));
      }
    });
  });
}

function normalizeZipCode(zipCode) {
  return String(zipCode ?? "")
    .replace(/\D/g, "")
    .slice(0, 5);
}

function normalizeMaterials(materials) {
  if (!Array.isArray(materials) || materials.length === 0) {
    return Object.keys(MATERIALS);
  }

  return materials.filter((material) => MATERIALS[material]);
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(...names) {
  for (const name of names) {
    if (process.env[name]) {
      return process.env[name];
    }
  }

  return null;
}

function getNumberEnv(name, fallback) {
  const value = Number(process.env[name] ?? fallback);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return value;
}

function getLowesUrl({ material, productId, state, zipCode }) {
  const template =
    process.env.LOWES_PRODUCT_PRICE_URL_TEMPLATE ??
    (process.env.LOWES_API_BASE_URL
      ? `${process.env.LOWES_API_BASE_URL.replace(/\/$/, "")}/products/{productId}?zipCode={zipCode}`
      : null);

  if (!template) {
    throw new Error(
      "Set LOWES_PRODUCT_PRICE_URL_TEMPLATE or LOWES_API_BASE_URL for Lowe's requests",
    );
  }

  const url = template
    .replaceAll("{material}", encodeURIComponent(material))
    .replaceAll("{productId}", encodeURIComponent(productId))
    .replaceAll("{state}", encodeURIComponent(state))
    .replaceAll("{zipCode}", encodeURIComponent(zipCode));
  const keyQueryParam = process.env.LOWES_API_KEY_QUERY_PARAM;

  if (!keyQueryParam) {
    return url;
  }

  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set(keyQueryParam, getRequiredEnv("LOWES_API_KEY"));
  return parsedUrl.toString();
}

function getValueAtPath(source, path) {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .reduce((value, part) => (value == null ? undefined : value[part]), source);
}

function toMoneyNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsedValue = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function findPriceByCommonPaths(responseBody, configuredPath) {
  const paths = configuredPath
    ? [configuredPath, ...DEFAULT_PRICE_PATHS]
    : DEFAULT_PRICE_PATHS;

  for (const path of paths) {
    const value = toMoneyNumber(getValueAtPath(responseBody, path));

    if (value != null) {
      return value;
    }
  }

  return null;
}

function findPriceRecursively(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return null;
  }

  seen.add(value);

  for (const [key, entryValue] of Object.entries(value)) {
    if (/^(sale|final|item|retail|selling)?price$/i.test(key)) {
      const parsedValue = toMoneyNumber(entryValue);

      if (parsedValue != null) {
        return parsedValue;
      }
    }
  }

  for (const entryValue of Object.values(value)) {
    const nestedPrice = findPriceRecursively(entryValue, seen);

    if (nestedPrice != null) {
      return nestedPrice;
    }
  }

  return null;
}

function extractPrice(responseBody, materialConfig) {
  const configuredPath =
    process.env[`${materialConfig.envPrefix}_PRICE_JSON_PATH`] ??
    process.env.LOWES_PRICE_JSON_PATH;
  const commonPathPrice = findPriceByCommonPaths(responseBody, configuredPath);

  if (commonPathPrice != null) {
    return commonPathPrice;
  }

  const recursivePrice = findPriceRecursively(responseBody);

  if (recursivePrice != null) {
    return recursivePrice;
  }

  throw new Error(
    `Could not find a price in Lowe's response for ${materialConfig.label}. Set ${materialConfig.envPrefix}_PRICE_JSON_PATH or LOWES_PRICE_JSON_PATH.`,
  );
}

function getBoardFeet(materialConfig) {
  const thicknessInches = getNumberEnv(
    `${materialConfig.envPrefix}_THICKNESS_INCHES`,
    process.env[`${materialConfig.unwrangleEnvPrefix}_THICKNESS_INCHES`] ??
      process.env.LUMBER_DEFAULT_THICKNESS_INCHES ??
      process.env.LOWES_DEFAULT_THICKNESS_INCHES ??
      2,
  );
  const widthInches = getNumberEnv(
    `${materialConfig.envPrefix}_WIDTH_INCHES`,
    process.env[`${materialConfig.unwrangleEnvPrefix}_WIDTH_INCHES`] ??
      process.env.LUMBER_DEFAULT_WIDTH_INCHES ??
      process.env.LOWES_DEFAULT_WIDTH_INCHES ??
      4,
  );
  const lengthFeet = getNumberEnv(
    `${materialConfig.envPrefix}_LENGTH_FEET`,
    process.env[`${materialConfig.unwrangleEnvPrefix}_LENGTH_FEET`] ??
      process.env.LUMBER_DEFAULT_LENGTH_FEET ??
      process.env.LOWES_DEFAULT_LENGTH_FEET ??
      8,
  );

  return (thicknessInches * widthInches * lengthFeet) / 12;
}

async function fetchLowesMaterialPrice({ material, state, zipCode }) {
  const materialConfig = MATERIALS[material];
  const productId = getRequiredEnv(`${materialConfig.envPrefix}_PRODUCT_ID`);
  const requestUrl = getLowesUrl({
    material,
    productId,
    state,
    zipCode,
  });
  const apiKeyHeader = process.env.LOWES_API_KEY_HEADER ?? "Ocp-Apim-Subscription-Key";
  const headers = {
    Accept: "application/json",
  };

  if (!process.env.LOWES_API_KEY_QUERY_PARAM) {
    headers[apiKeyHeader] = getRequiredEnv("LOWES_API_KEY");
  }

  const lowesResponse = await fetch(requestUrl, { headers });
  const responseText = await lowesResponse.text();

  if (!lowesResponse.ok) {
    throw new Error(
      `Lowe's request for ${materialConfig.label} failed with ${lowesResponse.status}: ${responseText.slice(0, 240)}`,
    );
  }

  const responseBody = JSON.parse(responseText);
  const itemPrice = extractPrice(responseBody, materialConfig);
  const boardFeet = getBoardFeet(materialConfig);
  const pricePerBoardFoot = itemPrice / boardFeet;

  return {
    detail: {
      boardFeet: roundPrice(boardFeet),
      itemPrice: roundPrice(itemPrice),
      label: materialConfig.label,
      pricePerBoardFoot: roundPrice(pricePerBoardFoot),
      productId,
    },
    priceField: materialConfig.responseField,
    pricePerBoardFoot: roundPrice(pricePerBoardFoot),
  };
}

function getUnwrangleProductUrl(materialConfig) {
  return getOptionalEnv(
    `${materialConfig.unwrangleEnvPrefix}_PRODUCT_URL`,
    `${materialConfig.envPrefix}_PRODUCT_URL`,
  );
}

function extractUnwranglePrice(responseBody, materialConfig) {
  const configuredPath =
    process.env[`${materialConfig.unwrangleEnvPrefix}_PRICE_JSON_PATH`] ??
    process.env.UNWRANGLE_PRICE_JSON_PATH;
  const price = findPriceByCommonPaths(responseBody, configuredPath);

  if (price == null) {
    throw new Error(
      `Could not find price in Unwrangle response for ${materialConfig.label}. Set ${materialConfig.unwrangleEnvPrefix}_PRICE_JSON_PATH or UNWRANGLE_PRICE_JSON_PATH.`,
    );
  }

  const priceUnit = process.env.UNWRANGLE_PRICE_UNIT ?? "cents";
  return priceUnit === "dollars" ? price : price / 100;
}

async function fetchUnwrangleMaterialPrice({ material, state, zipCode }) {
  const materialConfig = MATERIALS[material];
  const productUrl = getUnwrangleProductUrl(materialConfig);

  if (!productUrl) {
    throw new Error(
      `Missing ${materialConfig.unwrangleEnvPrefix}_PRODUCT_URL for ${materialConfig.label}`,
    );
  }

  const requestUrl = new URL(
    process.env.UNWRANGLE_API_URL ?? "https://data.unwrangle.com/api/getter/",
  );
  requestUrl.searchParams.set("platform", "lowes_detail");
  requestUrl.searchParams.set("url", productUrl);
  requestUrl.searchParams.set("zipcode", zipCode);
  requestUrl.searchParams.set("zip_state", state);
  requestUrl.searchParams.set("api_key", getRequiredEnv("UNWRANGLE_API_KEY"));

  if (process.env.UNWRANGLE_STORE_NO) {
    requestUrl.searchParams.set("store_no", process.env.UNWRANGLE_STORE_NO);
  }

  if (process.env.UNWRANGLE_INCLUDE_SOURCE) {
    requestUrl.searchParams.set("include_source", process.env.UNWRANGLE_INCLUDE_SOURCE);
  }

  const unwrangleResponse = await fetch(requestUrl);
  const responseText = await unwrangleResponse.text();

  if (!unwrangleResponse.ok) {
    throw new Error(
      `Unwrangle request for ${materialConfig.label} failed with ${unwrangleResponse.status}: ${responseText.slice(0, 240)}`,
    );
  }

  const responseBody = JSON.parse(responseText);

  if (responseBody.success === false) {
    throw new Error(
      `Unwrangle request for ${materialConfig.label} failed: ${responseBody.message ?? "Unknown API error"}`,
    );
  }

  const itemPrice = extractUnwranglePrice(responseBody, materialConfig);
  const boardFeet = getBoardFeet(materialConfig);
  const pricePerBoardFoot = itemPrice / boardFeet;

  return {
    detail: {
      boardFeet: roundPrice(boardFeet),
      itemPrice: roundPrice(itemPrice),
      label: materialConfig.label,
      pricePerBoardFoot: roundPrice(pricePerBoardFoot),
      productUrl,
    },
    priceField: materialConfig.responseField,
    pricePerBoardFoot: roundPrice(pricePerBoardFoot),
  };
}

function fetchMaterialPrice(requestOptions) {
  if (pricingProvider === "lowes") {
    return fetchLowesMaterialPrice(requestOptions);
  }

  if (pricingProvider === "unwrangle") {
    return fetchUnwrangleMaterialPrice(requestOptions);
  }

  throw new Error(
    `Unsupported LUMBER_PRICING_PROVIDER "${pricingProvider}". Use "unwrangle" or "lowes".`,
  );
}

async function handleLumberPrices(request, response, origin) {
  const body = await readJsonBody(request);
  const zipCode = normalizeZipCode(body.zipCode);
  const state = String(body.state ?? "").trim().toUpperCase();
  const materials = normalizeMaterials(body.materials);

  if (!state || zipCode.length !== 5) {
    sendJson(
      response,
      400,
      { error: "state and a 5-digit zipCode are required" },
      origin,
    );
    return;
  }

  if (materials.length === 0) {
    sendJson(response, 400, { error: "No supported materials requested" }, origin);
    return;
  }

  const materialPrices = await Promise.all(
    materials.map((material) =>
      fetchMaterialPrice({
        material,
        state,
        zipCode,
      }),
    ),
  );
  const prices = Object.fromEntries(
    materialPrices.map((materialPrice) => [
      materialPrice.priceField,
      materialPrice.pricePerBoardFoot,
    ]),
  );
  const details = Object.fromEntries(
    materialPrices.map((materialPrice) => [
      materialPrice.priceField,
      materialPrice.detail,
    ]),
  );

  sendJson(
    response,
    200,
    {
      checkedAt: new Date().toISOString(),
      details,
      market: `${zipCode}, ${state}`,
      prices,
      source: pricingProvider === "unwrangle" ? "Unwrangle Lowe's API" : "Lowe's API",
      state,
      zipCode,
    },
    origin,
  );
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;

  if (request.method === "OPTIONS") {
    response.writeHead(204, getCorsHeaders(origin));
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true }, origin);
    return;
  }

  if (request.method === "GET") {
    if (serveStaticAsset(request, response)) {
      return;
    }

    sendJson(response, 404, { error: "Not found" }, origin);
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/lumber-prices") {
    sendJson(response, 404, { error: "Not found" }, origin);
    return;
  }

  try {
    await handleLumberPrices(request, response, origin);
  } catch (error) {
    sendJson(
      response,
      502,
      {
        error: "Unable to load lumber pricing",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      origin,
    );
  }
});

server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Lumber pricing server listening on http://${host}:${port}`);
});
