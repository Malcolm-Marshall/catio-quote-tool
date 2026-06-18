import {
  DEFAULT_ENCLOSED_PATIO_INPUTS,
  DEFAULT_QUOTE_INPUTS,
  ENCLOSED_PATIO_STYLE_OPTIONS,
  FIXED_JOB_COSTS,
  LUMBER_MATERIAL_OPTIONS,
  PROJECT_COMPLEXITY_OPTIONS,
} from "../data/defaults.js";
import { CATIO_UPGRADES } from "../data/upgrades.js";

const toNumber = (value) => {
  if (typeof value === "string") {
    const cleanedValue = value.replace(/[$,%]/g, "").replace(/,/g, "");
    const number = Number(cleanedValue);
    return Number.isFinite(number) ? number : 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const roundMoney = (value) => Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;

const getSelectedItems = (items, selectedIds) => {
  const selectedIdSet = new Set(selectedIds ?? []);
  return items.filter((item) => selectedIdSet.has(item.id));
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getSelectedLumberMaterial = (lumberMaterial) =>
  LUMBER_MATERIAL_OPTIONS.find((option) => option.id === lumberMaterial) ??
  LUMBER_MATERIAL_OPTIONS[0];

const getLocalLumberPrice = (quoteInputs, materialId) => {
  const material = getSelectedLumberMaterial(materialId);
  return toNumber(quoteInputs[material.priceField]);
};

const getLumberPricing = (quoteInputs, selectedMaterialId = "pressure-treated") => {
  const selectedLumberMaterial = getSelectedLumberMaterial(selectedMaterialId);
  const localLumberPricePerBoardFoot = getLocalLumberPrice(
    quoteInputs,
    selectedLumberMaterial.id,
  );
  const baselineFuturesPrice = Math.max(
    toNumber(quoteInputs.baselineLumberFuturesPricePerThousandBoardFeet),
    1,
  );
  const currentFuturesPrice = toNumber(
    quoteInputs.lumberFuturesPricePerThousandBoardFeet,
  );
  const futuresBlendPercent = clamp(
    toNumber(quoteInputs.lumberFuturesBlendPercent),
    0,
    1,
  );
  const futuresMovementPercent =
    (currentFuturesPrice - baselineFuturesPrice) / baselineFuturesPrice;
  const futuresMultiplier = Math.max(
    0,
    1 + futuresMovementPercent * futuresBlendPercent,
  );
  const materialWastePercent = Math.max(
    toNumber(quoteInputs.materialWastePercent),
    0,
  );
  const materialWasteMultiplier = 1 + materialWastePercent;
  const localPressureTreatedLumberPricePerBoardFoot = getLocalLumberPrice(
    quoteInputs,
    "pressure-treated",
  );
  const localCedarLumberPricePerBoardFoot = getLocalLumberPrice(
    quoteInputs,
    "cedar",
  );
  const localRedwoodLumberPricePerBoardFoot = getLocalLumberPrice(
    quoteInputs,
    "redwood",
  );

  return {
    selectedLumberMaterial,
    localLumberPricePerBoardFoot,
    adjustedLumberPricePerBoardFoot: localLumberPricePerBoardFoot * futuresMultiplier,
    localPressureTreatedLumberPricePerBoardFoot,
    adjustedPressureTreatedLumberPricePerBoardFoot:
      localPressureTreatedLumberPricePerBoardFoot * futuresMultiplier,
    localCedarLumberPricePerBoardFoot,
    adjustedCedarLumberPricePerBoardFoot:
      localCedarLumberPricePerBoardFoot * futuresMultiplier,
    localRedwoodLumberPricePerBoardFoot,
    adjustedRedwoodLumberPricePerBoardFoot:
      localRedwoodLumberPricePerBoardFoot * futuresMultiplier,
    baselineFuturesPrice,
    currentFuturesPrice,
    futuresMovementPercent,
    futuresBlendPercent,
    futuresMultiplier,
    materialWastePercent,
    materialWasteMultiplier,
  };
};

const getCatioLumberUpgradePrice = (upgradeId, materialPricing, boardFeet, squareFeet) => {
  if (upgradeId === "catio-cedar-lumber") {
    return Math.max(
      materialPricing.adjustedCedarLumberPricePerBoardFoot -
        materialPricing.adjustedPressureTreatedLumberPricePerBoardFoot,
      0,
    ) * boardFeet;
  }

  if (upgradeId === "catio-redwood-lumber") {
    return Math.max(
      materialPricing.adjustedRedwoodLumberPricePerBoardFoot -
        materialPricing.adjustedPressureTreatedLumberPricePerBoardFoot,
      0,
    ) * boardFeet;
  }

  if (upgradeId === "catio-trex-decking") {
    const trexPricePerSquareFoot = 50;
    return squareFeet * trexPricePerSquareFoot;
  }

  return null;
};

const getPricedCatioUpgrades = (upgrades, materialPricing, boardFeet, squareFeet) =>
  upgrades.map((upgrade) => {
    const dynamicPrice = getCatioLumberUpgradePrice(
      upgrade.id,
      materialPricing,
      boardFeet,
      squareFeet,
    );

    if (dynamicPrice == null) {
      return upgrade;
    }

    return {
      ...upgrade,
      price: roundMoney(dynamicPrice),
    };
  });

export function calculateQuote(inputs = {}) {
  const quoteInputs = {
    ...DEFAULT_QUOTE_INPUTS,
    ...inputs,
  };

  const selectedComplexity =
    PROJECT_COMPLEXITY_OPTIONS.find(
      (option) => option.id === quoteInputs.complexityLevel,
    ) ?? PROJECT_COMPLEXITY_OPTIONS[0];

  const squareFeet =
    toNumber(quoteInputs.lengthFeet) * toNumber(quoteInputs.widthFeet);
  const materialPricing = getLumberPricing(quoteInputs, "pressure-treated");
  const catioBoardFeet =
    squareFeet *
    toNumber(quoteInputs.catioBoardFeetPerSquareFoot) *
    materialPricing.materialWasteMultiplier;
  const catioMaterialRate =
    toNumber(quoteInputs.catioNonLumberCostPerSquareFoot) +
    materialPricing.adjustedPressureTreatedLumberPricePerBoardFoot *
      toNumber(quoteInputs.catioBoardFeetPerSquareFoot) *
      materialPricing.materialWasteMultiplier;
  const catioMaterialTotal = squareFeet * catioMaterialRate;
  const deckBaseSquareFeet = quoteInputs.includeDeckBase ? squareFeet : 0;
  const catioDeckBaseBoardFeet =
    deckBaseSquareFeet *
    toNumber(quoteInputs.catioDeckBaseBoardFeetPerSquareFoot) *
    materialPricing.materialWasteMultiplier;
  const catioDeckBaseMaterialRate =
    toNumber(quoteInputs.catioDeckBaseNonLumberCostPerSquareFoot) +
    materialPricing.adjustedPressureTreatedLumberPricePerBoardFoot *
      toNumber(quoteInputs.catioDeckBaseBoardFeetPerSquareFoot) *
      materialPricing.materialWasteMultiplier;
  const deckBaseTotal = deckBaseSquareFeet * catioDeckBaseMaterialRate;
  const materialTotal = catioMaterialTotal + deckBaseTotal;
  const availableUpgrades = getPricedCatioUpgrades(
    CATIO_UPGRADES,
    materialPricing,
    catioBoardFeet + catioDeckBaseBoardFeet,
    squareFeet,
  );
  const selectedUpgrades = getSelectedItems(
    availableUpgrades,
    quoteInputs.selectedUpgradeIds,
  );
  const complexityMultiplier = Math.max(toNumber(selectedComplexity.multiplier), 1);
  const complexityTotal = materialTotal * (complexityMultiplier - 1);
  const upgradeTotal = selectedUpgrades.reduce(
    (total, upgrade) => total + toNumber(upgrade.price),
    0,
  );
  const fixedCostItems = FIXED_JOB_COSTS.map((cost) => ({
    ...cost,
    amount: toNumber(cost.amount),
  }));
  const dynamicCostItems = [
    { id: "materials", label: "Size and material", amount: catioMaterialTotal },
    { id: "deck-base", label: "Deck base", amount: deckBaseTotal },
    {
      id: "complexity",
      label: `${selectedComplexity.label} complexity`,
      amount: complexityTotal,
    },
  ];
  const baseCostItems = [...dynamicCostItems, ...fixedCostItems];
  const baseCostTotal = baseCostItems.reduce(
    (total, item) => total + toNumber(item.amount),
    0,
  );
  const quoteBeforeMarkup = baseCostTotal + upgradeTotal;
  const profitAmount = quoteBeforeMarkup * toNumber(quoteInputs.profitMarkupPercent);
  const totalQuote = quoteBeforeMarkup + profitAmount;

  return {
    quoteInputs,
    availableUpgrades,
    selectedComplexity,
    selectedUpgrades,
    baseCostItems,
    squareFeet: roundMoney(squareFeet),
    materialTotal: roundMoney(materialTotal),
    catioMaterialTotal: roundMoney(catioMaterialTotal),
    deckBaseSquareFeet: roundMoney(deckBaseSquareFeet),
    deckBaseTotal: roundMoney(deckBaseTotal),
    materialPricing: {
      ...materialPricing,
      adjustedLumberPricePerBoardFoot: roundMoney(
        materialPricing.adjustedPressureTreatedLumberPricePerBoardFoot,
      ),
      adjustedPressureTreatedLumberPricePerBoardFoot: roundMoney(
        materialPricing.adjustedPressureTreatedLumberPricePerBoardFoot,
      ),
      adjustedCedarLumberPricePerBoardFoot: roundMoney(
        materialPricing.adjustedCedarLumberPricePerBoardFoot,
      ),
      adjustedRedwoodLumberPricePerBoardFoot: roundMoney(
        materialPricing.adjustedRedwoodLumberPricePerBoardFoot,
      ),
      baselineFuturesPrice: roundMoney(materialPricing.baselineFuturesPrice),
      currentFuturesPrice: roundMoney(materialPricing.currentFuturesPrice),
      catioBoardFeet: roundMoney(catioBoardFeet),
      catioDeckBaseBoardFeet: roundMoney(catioDeckBaseBoardFeet),
      totalCatioBoardFeet: roundMoney(catioBoardFeet + catioDeckBaseBoardFeet),
      catioMaterialRate: roundMoney(catioMaterialRate),
      catioDeckBaseMaterialRate: roundMoney(catioDeckBaseMaterialRate),
    },
    complexityMultiplier,
    complexityTotal: roundMoney(complexityTotal),
    baseCostTotal: roundMoney(baseCostTotal),
    upgradeTotal: roundMoney(upgradeTotal),
    quoteBeforeMarkup: roundMoney(quoteBeforeMarkup),
    profitAmount: roundMoney(profitAmount),
    totalQuote: roundMoney(totalQuote),
    costPerSquareFoot: squareFeet > 0 ? roundMoney(totalQuote / squareFeet) : 0,
  };
}

export function calculateEnclosedPatioQuote(inputs = {}) {
  const quoteInputs = {
    ...DEFAULT_ENCLOSED_PATIO_INPUTS,
    ...inputs,
  };
  const style =
    ENCLOSED_PATIO_STYLE_OPTIONS.find(
      (option) => option.id === quoteInputs.patioStyle,
    ) ?? ENCLOSED_PATIO_STYLE_OPTIONS[0];

  const lengthFeet = toNumber(quoteInputs.lengthFeet);
  const widthFeet = toNumber(quoteInputs.widthFeet);
  const floorSquareFeet = lengthFeet * widthFeet;
  const wallSegments = (quoteInputs.walls ?? []).map((wall, index) => {
    const width = toNumber(wall.widthFeet);
    const height = toNumber(wall.heightFeet);
    const quantity = Math.max(toNumber(wall.quantity), 0);
    const squareFeet = width * height * quantity;
    const linearFeet = width * quantity;

    return {
      id: wall.id ?? `wall-${index + 1}`,
      label: wall.label || `Wall ${index + 1}`,
      widthFeet: width,
      heightFeet: height,
      quantity,
      squareFeet: roundMoney(squareFeet),
      linearFeet: roundMoney(linearFeet),
    };
  });
  const wallLinearFeet = wallSegments.reduce(
    (total, wall) => total + toNumber(wall.linearFeet),
    0,
  );
  const enclosureSquareFeet = wallSegments.reduce(
    (total, wall) => total + toNumber(wall.squareFeet),
    0,
  );
  const roofSquareFeet = quoteInputs.needsRoof ? floorSquareFeet : 0;
  const deckBaseSquareFeet = quoteInputs.includeDeckBase ? floorSquareFeet : 0;
  const materialPricing = getLumberPricing(
    quoteInputs,
    quoteInputs.lumberMaterial,
  );
  const wallMaterialRate =
    toNumber(quoteInputs.wallNonLumberCostPerSquareFoot) +
    materialPricing.adjustedLumberPricePerBoardFoot *
      toNumber(quoteInputs.wallBoardFeetPerSquareFoot) *
      materialPricing.materialWasteMultiplier;
  const roofMaterialRate =
    toNumber(quoteInputs.roofNonLumberCostPerSquareFoot) +
    materialPricing.adjustedLumberPricePerBoardFoot *
      toNumber(quoteInputs.roofBoardFeetPerSquareFoot) *
      materialPricing.materialWasteMultiplier;
  const deckBaseMaterialRate =
    toNumber(quoteInputs.deckBaseNonLumberCostPerSquareFoot) +
    materialPricing.adjustedLumberPricePerBoardFoot *
      toNumber(quoteInputs.deckBaseBoardFeetPerSquareFoot) *
      materialPricing.materialWasteMultiplier;
  const trimMaterialRate =
    toNumber(quoteInputs.trimNonLumberCostPerLinearFoot) +
    materialPricing.adjustedLumberPricePerBoardFoot *
      toNumber(quoteInputs.trimBoardFeetPerLinearFoot) *
      materialPricing.materialWasteMultiplier;
  const wallTotal =
    enclosureSquareFeet *
    wallMaterialRate *
    toNumber(style.wallMultiplier);
  const roofTotal =
    roofSquareFeet *
    roofMaterialRate *
    toNumber(style.roofMultiplier);
  const deckBaseTotal =
    deckBaseSquareFeet *
    deckBaseMaterialRate *
    toNumber(style.deckBaseMultiplier);
  const doorTotal = toNumber(quoteInputs.doorCount) * toNumber(quoteInputs.doorPrice);
  const shelfTotal =
    toNumber(quoteInputs.shelfCount) * toNumber(quoteInputs.shelfPrice);
  const trimTotal = quoteInputs.includeTrim
    ? wallLinearFeet * trimMaterialRate
    : 0;
  const catDoorTotal = quoteInputs.includeCatDoor ? toNumber(quoteInputs.catDoorPrice) : 0;
  const directCostItems = [
    { id: "wall-enclosure", label: "Wall enclosure", amount: wallTotal },
    { id: "roof", label: "Roof area", amount: roofTotal },
    {
      id: "deck-base",
      label: "Full deck base",
      amount: deckBaseTotal,
    },
    { id: "doors", label: "Doors", amount: doorTotal },
    { id: "shelves", label: "Shelves", amount: shelfTotal },
    { id: "trim", label: "Wall trim", amount: trimTotal },
    { id: "cat-door", label: "Cat door", amount: catDoorTotal },
  ];
  const directSubtotal = directCostItems.reduce(
    (total, item) => total + toNumber(item.amount),
    0,
  );
  const overheadTotal = directSubtotal * toNumber(quoteInputs.overheadPercent);
  const quoteBeforeMarkup = directSubtotal + overheadTotal;
  const profitAmount = quoteBeforeMarkup * toNumber(quoteInputs.profitMarkupPercent);
  const totalQuote = quoteBeforeMarkup + profitAmount;

  return {
    quoteInputs,
    style,
    selectedLumberMaterial: materialPricing.selectedLumberMaterial,
    materialPricing: {
      ...materialPricing,
      localLumberPricePerBoardFoot: roundMoney(
        materialPricing.localLumberPricePerBoardFoot,
      ),
      adjustedLumberPricePerBoardFoot: roundMoney(
        materialPricing.adjustedLumberPricePerBoardFoot,
      ),
      adjustedPressureTreatedLumberPricePerBoardFoot: roundMoney(
        materialPricing.adjustedPressureTreatedLumberPricePerBoardFoot,
      ),
      adjustedCedarLumberPricePerBoardFoot: roundMoney(
        materialPricing.adjustedCedarLumberPricePerBoardFoot,
      ),
      adjustedRedwoodLumberPricePerBoardFoot: roundMoney(
        materialPricing.adjustedRedwoodLumberPricePerBoardFoot,
      ),
      baselineFuturesPrice: roundMoney(materialPricing.baselineFuturesPrice),
      currentFuturesPrice: roundMoney(materialPricing.currentFuturesPrice),
      wallMaterialRate: roundMoney(wallMaterialRate),
      roofMaterialRate: roundMoney(roofMaterialRate),
      deckBaseMaterialRate: roundMoney(deckBaseMaterialRate),
      trimMaterialRate: roundMoney(trimMaterialRate),
    },
    directCostItems: directCostItems.map((item) => ({
      ...item,
      amount: roundMoney(item.amount),
    })),
    wallSegments,
    floorSquareFeet: roundMoney(floorSquareFeet),
    wallLinearFeet: roundMoney(wallLinearFeet),
    enclosureSquareFeet: roundMoney(enclosureSquareFeet),
    roofSquareFeet: roundMoney(roofSquareFeet),
    deckBaseSquareFeet: roundMoney(deckBaseSquareFeet),
    wallTotal: roundMoney(wallTotal),
    roofTotal: roundMoney(roofTotal),
    deckBaseTotal: roundMoney(deckBaseTotal),
    directSubtotal: roundMoney(directSubtotal),
    overheadTotal: roundMoney(overheadTotal),
    quoteBeforeMarkup: roundMoney(quoteBeforeMarkup),
    profitAmount: roundMoney(profitAmount),
    totalQuote: roundMoney(totalQuote),
    costPerFloorSquareFoot:
      floorSquareFeet > 0 ? roundMoney(totalQuote / floorSquareFeet) : 0,
    costPerEnclosureSquareFoot:
      enclosureSquareFeet > 0 ? roundMoney(totalQuote / enclosureSquareFeet) : 0,
  };
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(toNumber(value));

export const formatNumber = (value, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(toNumber(value));
