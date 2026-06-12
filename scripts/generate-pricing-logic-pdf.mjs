import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_ENCLOSED_PATIO_INPUTS,
  DEFAULT_QUOTE_INPUTS,
  ENCLOSED_PATIO_STYLE_OPTIONS,
  FIXED_JOB_COSTS,
} from "../src/data/defaults.js";
import { CATIO_UPGRADES } from "../src/data/upgrades.js";
import {
  calculateEnclosedPatioQuote,
  calculateQuote,
  formatCurrency,
  formatNumber,
} from "../src/lib/quoteCalculator.js";

const OUTPUT_PATH = resolve("docs/pricing-logic.pdf");
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;

const colors = {
  ink: [0.08, 0.11, 0.15],
  muted: [0.38, 0.43, 0.49],
  line: [0.72, 0.77, 0.82],
  softBlue: [0.92, 0.96, 0.99],
  softGreen: [0.92, 0.98, 0.94],
  softYellow: [1, 0.96, 0.82],
  softRed: [1, 0.92, 0.9],
  white: [1, 1, 1],
  blue: [0.08, 0.31, 0.55],
  green: [0.1, 0.45, 0.27],
  gold: [0.8, 0.47, 0.05],
  red: [0.65, 0.17, 0.16],
};

const pdfEscape = (value) =>
  String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");

const rgb = ([r, g, b]) => `${r} ${g} ${b}`;

const toMoney = (value) => formatCurrency(value).replace(".00", "");

const sum = (items, selector) =>
  items.reduce((total, item) => total + Number(selector(item) || 0), 0);

const averageCharWidth = (text, size) => {
  let units = 0;
  for (const char of String(text)) {
    if ("il.,'| ".includes(char)) units += 0.28;
    else if ("mwMW@#%".includes(char)) units += 0.82;
    else if ("ABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(char)) units += 0.62;
    else units += 0.5;
  }
  return units * size;
};

const wrapLines = (text, width, size = 9) => {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (averageCharWidth(candidate, size) <= width || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

class PdfPage {
  constructor() {
    this.ops = [];
  }

  y(top) {
    return PAGE_HEIGHT - top;
  }

  raw(op) {
    this.ops.push(op);
  }

  text(x, top, text, options = {}) {
    const {
      color = colors.ink,
      font = "F1",
      size = 10,
    } = options;
    this.raw(
      `BT /${font} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${this.y(top)} Tm (${pdfEscape(
        text,
      )}) Tj ET`,
    );
  }

  rect(x, top, width, height, options = {}) {
    const {
      fill = null,
      stroke = colors.line,
      lineWidth = 0.8,
    } = options;
    const y = this.y(top + height);
    if (fill) {
      this.raw(`${rgb(fill)} rg ${x} ${y} ${width} ${height} re f`);
    }
    if (stroke) {
      this.raw(`${lineWidth} w ${rgb(stroke)} RG ${x} ${y} ${width} ${height} re S`);
    }
  }

  line(x1, top1, x2, top2, options = {}) {
    const { color = colors.line, lineWidth = 0.8 } = options;
    this.raw(
      `${lineWidth} w ${rgb(color)} RG ${x1} ${this.y(top1)} m ${x2} ${this.y(
        top2,
      )} l S`,
    );
  }

  arrow(x1, top1, x2, top2, options = {}) {
    const { color = colors.blue, lineWidth = 1.2 } = options;
    this.line(x1, top1, x2, top2, { color, lineWidth });
    const angle = Math.atan2(top2 - top1, x2 - x1);
    const length = 6;
    const wing = Math.PI / 7;
    const a1 = angle + Math.PI - wing;
    const a2 = angle + Math.PI + wing;
    this.line(x2, top2, x2 + Math.cos(a1) * length, top2 + Math.sin(a1) * length, {
      color,
      lineWidth,
    });
    this.line(x2, top2, x2 + Math.cos(a2) * length, top2 + Math.sin(a2) * length, {
      color,
      lineWidth,
    });
  }

  paragraph(x, top, width, text, options = {}) {
    const {
      color = colors.ink,
      font = "F1",
      lineHeight = 12,
      size = 9,
    } = options;
    let cursor = top;
    for (const line of wrapLines(text, width, size)) {
      this.text(x, cursor, line, { color, font, size });
      cursor += lineHeight;
    }
    return cursor;
  }

  pill(x, top, text, options = {}) {
    const { fill = colors.softBlue, color = colors.blue } = options;
    const width = Math.max(56, averageCharWidth(text, 8.5) + 18);
    this.rect(x, top, width, 18, { fill, stroke: null });
    this.text(x + 9, top + 12, text, { color, font: "F2", size: 8.5 });
    return width;
  }

  box(x, top, width, height, title, body, options = {}) {
    const {
      fill = colors.white,
      stroke = colors.line,
      accent = colors.blue,
    } = options;
    this.rect(x, top, width, height, { fill, stroke });
    this.raw(`${rgb(accent)} rg ${x} ${this.y(top + height)} 4 ${height} re f`);
    this.text(x + 12, top + 17, title, { color: accent, font: "F2", size: 9.5 });
    this.paragraph(x + 12, top + 32, width - 20, body, {
      color: colors.ink,
      size: 8.2,
      lineHeight: 10.2,
    });
  }
}

class PdfDocument {
  constructor() {
    this.pages = [];
  }

  addPage(build) {
    const page = new PdfPage();
    build(page);
    this.pages.push(page.ops.join("\n"));
  }

  toBuffer() {
    const objects = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
    objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

    let nextId = 6;
    const pageIds = [];
    for (const stream of this.pages) {
      const contentId = nextId++;
      const pageId = nextId++;
      pageIds.push(pageId);
      objects[contentId] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`;
    }

    objects[2] = `<< /Type /Pages /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageIds.length} >>`;

    const chunks = ["%PDF-1.4\n"];
    const offsets = [0];

    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = Buffer.byteLength(chunks.join(""));
      chunks.push(`${id} 0 obj\n${objects[id]}\nendobj\n`);
    }

    const xrefOffset = Buffer.byteLength(chunks.join(""));
    chunks.push(`xref\n0 ${objects.length}\n`);
    chunks.push("0000000000 65535 f \n");
    for (let id = 1; id < objects.length; id += 1) {
      chunks.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
    }
    chunks.push(
      `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    );

    return Buffer.from(chunks.join(""), "utf8");
  }
}

const title = (page, text, subtitle) => {
  page.text(MARGIN, 50, text, { font: "F2", size: 21, color: colors.ink });
  if (subtitle) {
    page.paragraph(MARGIN, 70, 520, subtitle, {
      color: colors.muted,
      size: 9.5,
      lineHeight: 12,
    });
  }
  page.line(MARGIN, 92, PAGE_WIDTH - MARGIN, 92, { color: colors.line });
};

const footer = (page, number) => {
  page.line(MARGIN, 748, PAGE_WIDTH - MARGIN, 748, { color: colors.line });
  page.text(MARGIN, 765, "Sky Catio quote tool pricing logic", {
    color: colors.muted,
    size: 8,
  });
  page.text(PAGE_WIDTH - MARGIN - 36, 765, `Page ${number}`, {
    color: colors.muted,
    size: 8,
  });
};

const callout = (page, x, top, width, text, options = {}) => {
  const { fill = colors.softYellow, accent = colors.gold, height = 52 } = options;
  page.rect(x, top, width, height, { fill, stroke: null });
  page.raw(`${rgb(accent)} rg ${x} ${page.y(top + height)} 4 ${height} re f`);
  page.paragraph(x + 12, top + 18, width - 24, text, {
    color: colors.ink,
    size: 8.7,
    lineHeight: 11,
  });
};

const table = (page, x, top, columns, rows, options = {}) => {
  const {
    headerFill = colors.softBlue,
    rowFill = null,
    size = 8.2,
    lineHeight = 10.5,
    minRowHeight = 20,
    headerColor = colors.blue,
  } = options;
  const width = columns.reduce((total, column) => total + column.width, 0);
  let cursor = top;
  page.rect(x, cursor, width, 22, { fill: headerFill, stroke: colors.line });
  let cellX = x;
  for (const column of columns) {
    page.text(cellX + 5, cursor + 14, column.label, {
      color: headerColor,
      font: "F2",
      size,
    });
    cellX += column.width;
  }
  cursor += 22;

  rows.forEach((row, index) => {
    const cellLines = columns.map((column) =>
      wrapLines(row[column.key] ?? "", column.width - 10, size),
    );
    const rowHeight = Math.max(
      minRowHeight,
      Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + 8,
    );
    const fill = rowFill && index % 2 === 0 ? rowFill : colors.white;
    page.rect(x, cursor, width, rowHeight, { fill, stroke: colors.line, lineWidth: 0.5 });
    let innerX = x;
    for (let i = 0; i < columns.length; i += 1) {
      const column = columns[i];
      const lines = cellLines[i];
      lines.forEach((line, lineIndex) => {
        page.text(innerX + 5, cursor + 13 + lineIndex * lineHeight, line, {
          color: column.color || colors.ink,
          font: column.font || "F1",
          size,
        });
      });
      innerX += column.width;
      if (i < columns.length - 1) {
        page.line(innerX, cursor, innerX, cursor + rowHeight, {
          color: colors.line,
          lineWidth: 0.5,
        });
      }
    }
    cursor += rowHeight;
  });

  return cursor;
};

const twoColumnCostTable = (page, x, top, items) => {
  const midpoint = Math.ceil(items.length / 2);
  const left = items.slice(0, midpoint);
  const right = items.slice(midpoint);
  const rows = Array.from({ length: midpoint }, (_, index) => ({
    itemA: left[index]?.label ?? "",
    amountA: left[index] ? toMoney(left[index].amount) : "",
    itemB: right[index]?.label ?? "",
    amountB: right[index] ? toMoney(right[index].amount) : "",
  }));

  return table(
    page,
    x,
    top,
    [
      { key: "itemA", label: "Fixed cost", width: 170 },
      { key: "amountA", label: "Amount", width: 70, font: "F2" },
      { key: "itemB", label: "Fixed cost", width: 170 },
      { key: "amountB", label: "Amount", width: 70, font: "F2" },
    ],
    rows,
    { size: 7.4, lineHeight: 9.2, minRowHeight: 18, rowFill: [0.985, 0.99, 1] },
  );
};

const flow = (page, top, labels, options = {}) => {
  const {
    x = MARGIN,
    width = 98,
    height = 76,
    gap = 10,
    fills = [colors.softBlue, colors.softGreen, colors.softYellow, colors.softBlue],
  } = options;
  labels.forEach((item, index) => {
    const left = x + index * (width + gap);
    page.box(left, top, width, height, item.title, item.body, {
      fill: fills[index % fills.length],
      accent: item.accent || colors.blue,
    });
    if (index < labels.length - 1) {
      page.arrow(left + width + 1, top + height / 2, left + width + gap - 2, top + height / 2, {
        color: colors.blue,
      });
    }
  });
};

const catioQuote = calculateQuote(DEFAULT_QUOTE_INPUTS);
const patioQuote = calculateEnclosedPatioQuote(DEFAULT_ENCLOSED_PATIO_INPUTS);
const fixedCostTotal = sum(FIXED_JOB_COSTS, (item) => item.amount);
const defaultCatioUpgradeNames = catioQuote.selectedUpgrades
  .map((upgrade) => `${upgrade.name} (${toMoney(upgrade.price)})`)
  .join(", ");

const doc = new PdfDocument();

doc.addPage((page) => {
  title(
    page,
    "Pricing Logic Visual Guide",
    "Generated from the current React calculator code on May 13, 2026. The goal is to show the live formulas, default rates, and which fields actually move price.",
  );

  page.pill(MARGIN, 110, "Catio calculator", { fill: colors.softBlue, color: colors.blue });
  page.pill(MARGIN + 130, 110, "Enclosed patio calculator", {
    fill: colors.softGreen,
    color: colors.green,
  });
  page.pill(MARGIN + 300, 110, "Source: src/lib/quoteCalculator.js", {
    fill: colors.softYellow,
    color: colors.gold,
  });

  page.text(MARGIN, 160, "Catio Price Pipeline", {
    font: "F2",
    size: 14,
    color: colors.blue,
  });
  flow(page, 178, [
    {
      title: "Inputs",
      body: "State/ZIP, dimensions, local lumber prices, futures inputs, complexity level, fixed costs, and selected upgrade IDs.",
      accent: colors.blue,
    },
    {
      title: "Area + Material",
      body: "Square feet, pressure-treated lumber $/bf, futures adjustment, waste, and non-lumber allowance create material subtotal.",
      accent: colors.green,
    },
    {
      title: "Base + Options",
      body: "Size/material subtotal, complexity adjustment, fixed job costs, and selected upgrade prices.",
      accent: colors.gold,
    },
    {
      title: "Markup",
      body: "Profit markup is applied to the full pre-markup subtotal.",
      accent: colors.red,
    },
    {
      title: "Outputs",
      body: "Customer quote, cost per sq ft, material subtotal, complexity adjustment, and contractor targets.",
      accent: colors.blue,
    },
  ]);

  page.text(MARGIN, 300, "Enclosed Patio Price Pipeline", {
    font: "F2",
    size: 14,
    color: colors.green,
  });
  flow(page, 318, [
    {
      title: "Inputs",
      body: "Deck size, wall sections, state/ZIP, style, lumber material, local lumber prices, futures inputs, overhead, and markup.",
      accent: colors.green,
    },
    {
      title: "Areas",
      body: "Floor sq ft, wall sq ft, wall linear ft, roof sq ft, and deck base sq ft.",
      accent: colors.blue,
    },
    {
      title: "Direct Costs",
      body: "Dynamic wall, roof, deck base, and trim material rates plus doors, shelves, and cat door.",
      accent: colors.gold,
    },
    {
      title: "Overhead",
      body: "Overhead percent applies to direct subtotal before profit markup.",
      accent: colors.red,
    },
    {
      title: "Outputs",
      body: "Patio quote, cost per floor sq ft, and cost per enclosure sq ft.",
      accent: colors.green,
    },
  ]);

  callout(
    page,
    MARGIN,
    455,
    528,
    "Important: some UI fields are stored for quoting context but are not currently part of the price formula. Those fields are called out later so you can decide whether they should become pricing drivers.",
    { fill: colors.softRed, accent: colors.red, height: 58 },
  );

  table(
    page,
    MARGIN,
    545,
    [
      { key: "calculator", label: "Calculator", width: 135, font: "F2" },
      { key: "sample", label: "Default sample output", width: 150, font: "F2" },
      { key: "mainDrivers", label: "Main pricing drivers", width: 243 },
    ],
    [
      {
        calculator: "Catio",
        sample: `${toMoney(catioQuote.totalQuote)} total, ${toMoney(
          catioQuote.costPerSquareFoot,
        )}/sq ft`,
        mainDrivers:
          "State/ZIP market, length x width, local $/board foot, futures adjustment, complexity multiplier, fixed job costs, selected upgrades, markup.",
      },
      {
        calculator: "Enclosed Patio",
        sample: `${toMoney(patioQuote.totalQuote)} total, ${toMoney(
          patioQuote.costPerFloorSquareFoot,
        )}/floor sq ft`,
        mainDrivers:
          "Wall sections, state/ZIP market, lumber material, local $/board foot, futures adjustment, style multipliers, doors, shelves, overhead, markup.",
      },
    ],
    { size: 8.4, lineHeight: 10.5, rowFill: [0.985, 0.99, 1] },
  );

  footer(page, 1);
});

doc.addPage((page) => {
  title(
    page,
    "Catio Formula Map",
    "This page follows calculateQuote(). Percent values are stored as decimals, so 0.38 means 38%.",
  );

  flow(
    page,
    115,
    [
      { title: "1. Area", body: "squareFeet = lengthFeet x widthFeet" },
      {
        title: "2. Complexity",
        body: "The selected complexity level chooses the multiplier for the material subtotal.",
        accent: colors.green,
      },
      {
        title: "3. Dynamic Cost",
        body: "Material total uses pressure-treated lumber. Optional deck base pricing uses the catio footprint area.",
        accent: colors.gold,
      },
      {
        title: "4. Adders",
        body: "Fixed job costs plus selected catio upgrade prices.",
        accent: colors.red,
      },
      {
        title: "5. Quote",
        body: "Markup creates profit amount, then total quote.",
      },
    ],
    { height: 80 },
  );

  const formulaRows = [
    ["Square feet", "lengthFeet x widthFeet"],
    ["Futures multiplier", "1 + futures movement percent x futures blend percent"],
    ["Adjusted pressure-treated $/bf", "local pressure-treated $/bf x futuresMultiplier"],
    ["Catio board feet", "squareFeet x catioBoardFeetPerSquareFoot x waste"],
    ["Catio material rate", "catio non-lumber $/sq ft + adjusted pressure-treated $/bf x catio bf/sq ft x waste"],
    ["Deck base sq ft", "includeDeckBase ? squareFeet : 0"],
    ["Deck base board feet", "deckBaseSquareFeet x catioDeckBaseBoardFeetPerSquareFoot x waste"],
    ["Deck base rate", "deck non-lumber $/sq ft + adjusted pressure-treated $/bf x deck bf/sq ft x waste"],
    ["Deck base total", "deckBaseSquareFeet x catioDeckBaseMaterialRate"],
    ["Selected complexity", "PROJECT_COMPLEXITY_OPTIONS match by complexityLevel"],
    ["Complexity multiplier", "max(selectedComplexity.multiplier, 1)"],
    ["Material total", "catioMaterialTotal + deckBaseTotal"],
    ["Complexity total", "materialTotal x (complexityMultiplier - 1)"],
    ["Cedar/redwood lumber upgrades", "max(adjusted upgrade lumber $/bf - adjusted pressure-treated $/bf, 0) x totalCatioBoardFeet"],
    ["Base cost total", "materialTotal + complexityTotal + all fixed job costs"],
    ["Catio upgrade total", "sum(price) for selected catio upgrades"],
    ["Quote before markup", "baseCostTotal + upgradeTotal"],
    ["Profit amount", "quoteBeforeMarkup x profitMarkupPercent"],
    ["Total quote", "quoteBeforeMarkup + profitAmount"],
    ["Cost per sq ft", "totalQuote / squareFeet when squareFeet is above 0"],
  ].map(([step, formula]) => ({ step, formula }));

  table(
    page,
    MARGIN,
    242,
    [
      { key: "step", label: "Step", width: 150, font: "F2" },
      { key: "formula", label: "Formula", width: 378 },
    ],
    formulaRows,
    { size: 8.1, lineHeight: 10, minRowHeight: 18, rowFill: [0.985, 0.99, 1] },
  );

  table(
    page,
    MARGIN,
    635,
    [
      { key: "metric", label: "Default metric", width: 164, font: "F2" },
      { key: "value", label: "Current default value", width: 100, font: "F2" },
      { key: "note", label: "Context", width: 264 },
    ],
    [
      {
        metric: "Customer price",
        value: toMoney(catioQuote.totalQuote),
        note: `${formatNumber(catioQuote.squareFeet)} sq ft with ${defaultCatioUpgradeNames || "no selected upgrades"}.`,
      },
      {
        metric: "Complexity",
        value: `${catioQuote.selectedComplexity.label} (${formatNumber(
          catioQuote.complexityMultiplier,
        )}x)`,
        note: `${toMoney(catioQuote.complexityTotal)} complexity adjustment on ${toMoney(catioQuote.materialTotal)} material subtotal.`,
      },
      {
        metric: "Material rate",
        value: toMoney(catioQuote.materialPricing.catioMaterialRate),
        note: `${toMoney(catioQuote.materialPricing.adjustedPressureTreatedLumberPricePerBoardFoot)}/bf pressure-treated lumber with ${formatNumber(catioQuote.materialPricing.totalCatioBoardFeet)} total board feet.`,
      },
      {
        metric: "Deck base default",
        value: DEFAULT_QUOTE_INPUTS.includeDeckBase ? "Included" : "Not included",
        note: `When included, deck base uses ${formatNumber(DEFAULT_QUOTE_INPUTS.catioDeckBaseBoardFeetPerSquareFoot)} bf/sq ft over the catio footprint.`,
      },
      {
        metric: "Before markup / markup",
        value: `${toMoney(catioQuote.quoteBeforeMarkup)} / ${toMoney(
          catioQuote.profitAmount,
        )}`,
        note: "Markup is applied after fixed costs and selected option prices are included.",
      },
    ],
    { size: 7.8, lineHeight: 9.5, minRowHeight: 22, rowFill: [0.985, 0.99, 1] },
  );

  footer(page, 2);
});

doc.addPage((page) => {
  title(
    page,
    "Catio Data Sources and Adjustment Notes",
    "The base catio quote combines size/material pricing, complexity adjustment, fixed job costs, selected upgrade prices, and markup.",
  );

  page.text(MARGIN, 120, `Fixed job costs: ${toMoney(fixedCostTotal)} total`, {
    font: "F2",
    size: 12,
    color: colors.blue,
  });
  twoColumnCostTable(page, MARGIN, 135, FIXED_JOB_COSTS);

  table(
    page,
    MARGIN,
    380,
    [
      { key: "source", label: "Source", width: 135, font: "F2" },
      { key: "pricingUse", label: "Current pricing use", width: 245 },
      { key: "adjustment", label: "Adjustment lever", width: 148 },
    ],
    [
      {
        source: "CATIO_UPGRADES",
        pricingUse: "Selected upgrade price adds to quote. Cedar/redwood lumber upgrade prices are generated from live lumber price deltas.",
        adjustment: "Change static prices in src/data/upgrades.js or lumber assumptions in src/data/defaults.js.",
      },
      {
        source: "Fixed job costs",
        pricingUse: "Every fixed cost amount is always included when amount is above or equal to 0.",
        adjustment: "Change FIXED_JOB_COSTS in src/data/defaults.js.",
      },
    ],
    { size: 8.1, lineHeight: 10.2, minRowHeight: 34, rowFill: [0.985, 0.99, 1] },
  );

  callout(
    page,
    MARGIN,
    525,
    528,
    "Visible catio controls now feed the price formula. Deck base is priced from the catio footprint area and adds to the board feet used by cedar/redwood lumber upgrades.",
    { fill: colors.softRed, accent: colors.red, height: 66 },
  );

  table(
    page,
    MARGIN,
    622,
    [
      { key: "question", label: "Decision to make", width: 230, font: "F2" },
      { key: "possibleChange", label: "Possible formula change", width: 298 },
    ],
    [
      {
        question: "Should catio height or roof be added later?",
        possibleChange: "Only add those controls when they also add wall/enclosure surface area or roof area costs.",
      },
      {
        question: "Should deck base assumptions vary by build type?",
        possibleChange: "Adjust catioDeckBaseBoardFeetPerSquareFoot or catioDeckBaseNonLumberCostPerSquareFoot in defaults.",
      },
      {
        question: "Should selected upgrades affect complexity?",
        possibleChange: "Map upgrade selections to a complexity level or add upgrade-specific complexity adjustments.",
      },
    ],
    { size: 8.1, lineHeight: 10.2, minRowHeight: 30, rowFill: [0.985, 0.99, 1] },
  );

  footer(page, 3);
});

doc.addPage((page) => {
  title(
    page,
    "Enclosed Patio Formula Map",
    "This page follows calculateEnclosedPatioQuote(). Wall sections are the main geometry driver.",
  );

  flow(
    page,
    115,
    [
      { title: "1. Floor", body: "floorSquareFeet = lengthFeet x widthFeet" },
      {
        title: "2. Material Rates",
        body: "Local lumber $/bf is adjusted by futures movement, blend percent, and waste.",
        accent: colors.green,
      },
      {
        title: "3. Optional Areas",
        body: "Wall rows drive wall area. Roof and deck base use floor sq ft only when toggles are on.",
        accent: colors.gold,
      },
      {
        title: "4. Direct Costs",
        body: "Dynamic material rates plus doors, shelves, and cat door.",
        accent: colors.red,
      },
      {
        title: "5. Quote",
        body: "Direct subtotal plus overhead, then markup, then total quote.",
      },
    ],
    { height: 80 },
  );

  const formulaRows = [
    ["Floor sq ft", "lengthFeet x widthFeet"],
    ["Wall segment sq ft", "wall.widthFeet x wall.heightFeet x wall.quantity"],
    ["Wall segment linear ft", "wall.widthFeet x wall.quantity"],
    ["Enclosure sq ft", "sum of wall segment square feet"],
    ["Wall linear ft", "sum of wall segment linear feet"],
    ["Roof sq ft", "needsRoof ? floorSquareFeet : 0"],
    ["Deck base sq ft", "includeDeckBase ? floorSquareFeet : 0"],
    ["Selected lumber", "LUMBER_MATERIAL_OPTIONS match by lumberMaterial"],
    ["Futures multiplier", "1 + futures movement percent x futures blend percent"],
    ["Adjusted lumber $/bf", "selected local lumber $/bf x futuresMultiplier"],
    ["Wall material rate", "wall non-lumber $/sq ft + adjusted $/bf x wall bf/sq ft x waste"],
    ["Roof material rate", "roof non-lumber $/sq ft + adjusted $/bf x roof bf/sq ft x waste"],
    ["Deck material rate", "deck non-lumber $/sq ft + adjusted $/bf x deck bf/sq ft x waste"],
    ["Trim material rate", "trim non-lumber $/ft + adjusted $/bf x trim bf/ft x waste"],
    ["Wall total", "enclosureSquareFeet x wallMaterialRate x style.wallMultiplier"],
    ["Roof total", "roofSquareFeet x roofMaterialRate x style.roofMultiplier"],
    ["Deck base total", "deckBaseSquareFeet x deckBaseMaterialRate x style.deckBaseMultiplier"],
    ["Door total", "doorCount x doorPrice"],
    ["Shelf total", "shelfCount x shelfPrice"],
    ["Trim total", "includeTrim ? wallLinearFeet x trimMaterialRate : 0"],
    ["Cat door total", "includeCatDoor ? catDoorPrice : 0"],
    ["Direct subtotal", "sum of all direct cost items"],
    ["Overhead total", "directSubtotal x overheadPercent"],
    ["Quote before markup", "directSubtotal + overheadTotal"],
    ["Profit amount", "quoteBeforeMarkup x profitMarkupPercent"],
    ["Total quote", "quoteBeforeMarkup + profitAmount"],
  ].map(([step, formula]) => ({ step, formula }));

  table(
    page,
    MARGIN,
    242,
    [
      { key: "step", label: "Step", width: 150, font: "F2" },
      { key: "formula", label: "Formula", width: 378 },
    ],
    formulaRows,
    { size: 7.5, lineHeight: 9.2, minRowHeight: 17, rowFill: [0.985, 0.99, 1] },
  );

  table(
    page,
    MARGIN,
    650,
    [
      { key: "metric", label: "Default metric", width: 164, font: "F2" },
      { key: "value", label: "Current default value", width: 100, font: "F2" },
      { key: "note", label: "Context", width: 264 },
    ],
    [
      {
        metric: "Patio quote",
        value: toMoney(patioQuote.totalQuote),
        note: `${formatNumber(patioQuote.floorSquareFeet)} floor sq ft and ${formatNumber(
          patioQuote.enclosureSquareFeet,
        )} wall sq ft.`,
      },
      {
        metric: "Direct subtotal / overhead",
        value: `${toMoney(patioQuote.directSubtotal)} / ${toMoney(
          patioQuote.overheadTotal,
        )}`,
        note: "Overhead is added before profit markup.",
      },
      {
        metric: "Cost per floor sq ft",
        value: toMoney(patioQuote.costPerFloorSquareFoot),
        note: `Style: ${patioQuote.style.label}.`,
      },
    ],
    { size: 7.8, lineHeight: 9.5, minRowHeight: 22, rowFill: [0.985, 0.99, 1] },
  );

  footer(page, 4);
});

doc.addPage((page) => {
  title(
    page,
    "Enclosed Patio Defaults and Multipliers",
    "The enclosed patio calculator prices wall enclosure area more explicitly than the catio calculator.",
  );

  table(
    page,
    MARGIN,
    118,
    [
      { key: "style", label: "Patio style", width: 205, font: "F2" },
      { key: "wall", label: "Wall x", width: 70, font: "F2" },
      { key: "roof", label: "Roof x", width: 70, font: "F2" },
      { key: "deck", label: "Deck base x", width: 90, font: "F2" },
      { key: "use", label: "Pricing effect", width: 93 },
    ],
    ENCLOSED_PATIO_STYLE_OPTIONS.map((style) => ({
      style: style.label,
      wall: String(style.wallMultiplier),
      roof: String(style.roofMultiplier),
      deck: String(style.deckBaseMultiplier),
      use: "Multiplies area-based costs.",
    })),
    { size: 8, lineHeight: 10, minRowHeight: 24, rowFill: [0.985, 0.99, 1] },
  );

  table(
    page,
    MARGIN,
    238,
    [
      { key: "input", label: "Default input", width: 168, font: "F2" },
      { key: "value", label: "Value", width: 98, font: "F2" },
      { key: "pricingUse", label: "Pricing use", width: 262 },
    ],
    [
      {
        input: "Deck length x width",
        value: `${DEFAULT_ENCLOSED_PATIO_INPUTS.lengthFeet} x ${DEFAULT_ENCLOSED_PATIO_INPUTS.widthFeet}`,
        pricingUse: "Creates floor square feet for roof/deck base and per-floor reporting.",
      },
      {
        input: "Default walls",
        value: DEFAULT_ENCLOSED_PATIO_INPUTS.walls
          .map((wall) => `${wall.quantity}x ${wall.widthFeet}x${wall.heightFeet}`)
          .join(", "),
        pricingUse: "Creates enclosure sq ft and wall linear ft.",
      },
      {
        input: "State / ZIP market",
        value: `${DEFAULT_ENCLOSED_PATIO_INPUTS.localLumberPriceMarket} ${DEFAULT_ENCLOSED_PATIO_INPUTS.zipCode}`,
        pricingUse: "Selects the local lumber price set that fills the board-foot prices.",
      },
      {
        input: "Lumber material",
        value: patioQuote.selectedLumberMaterial.label,
        pricingUse: "Selects which local $/board foot value feeds material rates.",
      },
      {
        input: "Local lumber $/bf",
        value: toMoney(patioQuote.materialPricing.localLumberPricePerBoardFoot),
        pricingUse: "Anchors the dynamic material price from the state pricing lookup.",
      },
      {
        input: "Futures current / baseline",
        value: `${toMoney(patioQuote.materialPricing.currentFuturesPrice)} / ${toMoney(
          patioQuote.materialPricing.baselineFuturesPrice,
        )}`,
        pricingUse: "Creates the futures movement used to adjust local lumber.",
      },
      {
        input: "Blend / waste",
        value: `${DEFAULT_ENCLOSED_PATIO_INPUTS.lumberFuturesBlendPercent} / ${DEFAULT_ENCLOSED_PATIO_INPUTS.materialWastePercent}`,
        pricingUse: "Controls how much futures movement matters, plus material waste.",
      },
      {
        input: "Wall / roof / deck rates",
        value: `${toMoney(patioQuote.materialPricing.wallMaterialRate)} / ${toMoney(
          patioQuote.materialPricing.roofMaterialRate,
        )} / ${toMoney(patioQuote.materialPricing.deckBaseMaterialRate)}`,
        pricingUse: "Derived from local lumber, futures adjustment, board-foot factors, and non-lumber allowances.",
      },
      {
        input: "Door / shelf / cat door",
        value: `${toMoney(DEFAULT_ENCLOSED_PATIO_INPUTS.doorPrice)} / ${toMoney(
          DEFAULT_ENCLOSED_PATIO_INPUTS.shelfPrice,
        )} / ${toMoney(DEFAULT_ENCLOSED_PATIO_INPUTS.catDoorPrice)}`,
        pricingUse: "Count-based or toggle-based direct costs.",
      },
      {
        input: "Trim",
        value: `${toMoney(patioQuote.materialPricing.trimMaterialRate)}/linear ft`,
        pricingUse: "Derived material rate; only applies when includeTrim is true.",
      },
      {
        input: "Overhead / markup",
        value: `${DEFAULT_ENCLOSED_PATIO_INPUTS.overheadPercent} / ${DEFAULT_ENCLOSED_PATIO_INPUTS.profitMarkupPercent}`,
        pricingUse: "Overhead applies to direct subtotal; markup applies after overhead.",
      },
    ],
    { size: 8, lineHeight: 10, minRowHeight: 32, rowFill: [0.985, 0.99, 1] },
  );

  table(
    page,
    MARGIN,
    490,
    [
      { key: "cost", label: "Default direct cost item", width: 240, font: "F2" },
      { key: "amount", label: "Amount", width: 95, font: "F2" },
      { key: "note", label: "When included", width: 193 },
    ],
    patioQuote.directCostItems.map((item) => ({
      cost: item.label,
      amount: toMoney(item.amount),
      note:
        item.id === "roof"
          ? "Only when roof needed is true."
          : item.id === "deck-base"
            ? "Only when full deck base is true."
            : item.id === "trim"
              ? "Only when finishing trim is true."
              : item.id === "cat-door"
                ? "Only when cat door is true."
                : "Included by count or area.",
    })),
    { size: 8, lineHeight: 10, minRowHeight: 22, rowFill: [0.985, 0.99, 1] },
  );

  callout(
    page,
    MARGIN,
    690,
    528,
    "Visible patio controls feed pricing. State and ZIP update local lumber prices; wall row width, height, and quantity drive enclosure square footage.",
    { fill: colors.softYellow, accent: colors.gold, height: 46 },
  );

  footer(page, 5);
});

doc.addPage((page) => {
  title(
    page,
    "Adjustment Map",
    "Use this as a quick guide when changing the pricing model or UI knobs.",
  );

  table(
    page,
    MARGIN,
    118,
    [
      { key: "change", label: "What you want to change", width: 180, font: "F2" },
      { key: "file", label: "Where to edit", width: 164, font: "F2" },
      { key: "notes", label: "Notes", width: 184 },
    ],
    [
      {
        change: "Catio default rates, percents, complexity, dimensions, deck base",
        file: "src/data/defaults.js",
        notes: "DEFAULT_QUOTE_INPUTS controls reset state and first load.",
      },
      {
        change: "Fixed catio job cost amounts",
        file: "src/data/defaults.js",
        notes: "FIXED_JOB_COSTS is always included in baseCostTotal.",
      },
      {
        change: "Catio upgrade prices",
        file: "src/data/upgrades.js",
        notes: "Selected price values are added before markup.",
      },
      {
        change: "Catio core formulas",
        file: "src/lib/quoteCalculator.js",
        notes: "calculateQuote() owns the pricing math and returned summary values.",
      },
      {
        change: "Patio material rates, toggles, wall rows",
        file: "src/data/defaults.js",
        notes: "DEFAULT_ENCLOSED_PATIO_INPUTS controls reset state and first load.",
      },
      {
        change: "Patio style multipliers",
        file: "src/data/defaults.js",
        notes: "ENCLOSED_PATIO_STYLE_OPTIONS controls wall, roof, and deck multipliers.",
      },
      {
        change: "Patio core formulas",
        file: "src/lib/quoteCalculator.js",
        notes: "calculateEnclosedPatioQuote() owns the pricing math.",
      },
      {
        change: "Visible fields and labels",
        file: "src/components/*.jsx",
        notes: "QuoteForm and EnclosedPatioCalculator render input controls.",
      },
      {
        change: "Numeric input parsing",
        file: "src/App.jsx",
        notes: "Add new numeric fields to numericFields so values are stored as numbers.",
      },
    ],
    { size: 8.1, lineHeight: 10.2, minRowHeight: 31, rowFill: [0.985, 0.99, 1] },
  );

  page.text(MARGIN, 460, "High-leverage pricing decisions to confirm", {
    font: "F2",
    size: 13,
    color: colors.blue,
  });

  table(
    page,
    MARGIN,
    480,
    [
      { key: "topic", label: "Topic", width: 160, font: "F2" },
      { key: "why", label: "Why it matters", width: 368 },
    ],
    [
      {
        topic: "Catio uses footprint size",
        why: "Length and width drive the catio material subtotal, and the deck base toggle uses that same footprint area.",
      },
      {
        topic: "Upgrade price is customer-facing",
        why: "Upgrade price adds to the quote as a direct option adder before markup.",
      },
      {
        topic: "Patio walls are explicit",
        why: "Patio pricing is more geometry-based; changing wall rows immediately changes enclosure sq ft and trim linear ft.",
      },
      {
        topic: "Markup order differs from overhead",
        why: "For patio, overhead is added first, then markup. For catio, there is no separate overhead step.",
      },
    ],
    { size: 8.4, lineHeight: 10.5, minRowHeight: 34, rowFill: [0.985, 0.99, 1] },
  );

  callout(
    page,
    MARGIN,
    680,
    528,
    "Regenerate this PDF after formula or data changes by running: node scripts/generate-pricing-logic-pdf.mjs",
    { fill: colors.softGreen, accent: colors.green, height: 44 },
  );

  footer(page, 6);
});

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, doc.toBuffer());
console.log(`Wrote ${OUTPUT_PATH}`);
