import { DEFAULT_QUOTE_INPUTS, FIXED_JOB_COSTS } from "../data/defaults.js";
import { CATIO_UPGRADES, TUNNEL_UPGRADES } from "../data/upgrades.js";

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

const sumItemHours = (items, fieldName) =>
  items.reduce((total, item) => total + toNumber(item[fieldName]), 0);

export function calculateQuote(inputs = {}) {
  const quoteInputs = {
    ...DEFAULT_QUOTE_INPUTS,
    ...inputs,
  };

  const selectedUpgrades = getSelectedItems(
    CATIO_UPGRADES,
    quoteInputs.selectedUpgradeIds,
  );
  const selectedTunnelUpgrades = getSelectedItems(
    TUNNEL_UPGRADES,
    quoteInputs.selectedTunnelUpgradeIds,
  );

  const squareFeet =
    toNumber(quoteInputs.lengthFeet) * toNumber(quoteInputs.widthFeet);
  const oneCarpenterBuildDays =
    squareFeet / Math.max(toNumber(quoteInputs.squareFeetPerDay), 1);
  const crewBuildDays =
    oneCarpenterBuildDays / Math.max(toNumber(quoteInputs.carpenterCount), 1);
  const totalBuildDays =
    crewBuildDays +
    toNumber(quoteInputs.dayBreaks) +
    sumItemHours(selectedUpgrades, "extraHours") / 8;
  const laborHoursPerCarpenter =
    oneCarpenterBuildDays * toNumber(quoteInputs.laborHoursPerBuildDay);
  const totalCrewLaborHours =
    laborHoursPerCarpenter * toNumber(quoteInputs.carpenterCount);
  const materialTotal =
    squareFeet * toNumber(quoteInputs.materialCostPerSquareFoot);
  const laborTotal =
    laborHoursPerCarpenter *
    toNumber(quoteInputs.contractorHourlyRate) *
    toNumber(quoteInputs.carpenterCount);
  const upgradeTotal = selectedUpgrades.reduce(
    (total, upgrade) => total + toNumber(upgrade.price),
    0,
  );
  const tunnelUpgradeTotal = selectedTunnelUpgrades.reduce(
    (total, upgrade) => total + toNumber(upgrade.price),
    0,
  );
  const fixedCostItems = FIXED_JOB_COSTS.map((cost) => ({
    ...cost,
    amount: toNumber(cost.amount),
  }));
  const dynamicCostItems = [
    { id: "materials", label: "Material cost", amount: materialTotal },
    { id: "carpenter-labor", label: "Catio carpenter", amount: laborTotal },
  ];
  const baseCostItems = [...dynamicCostItems, ...fixedCostItems];
  const baseCostTotal = baseCostItems.reduce(
    (total, item) => total + toNumber(item.amount),
    0,
  );
  const quoteBeforeMarkup = baseCostTotal + upgradeTotal + tunnelUpgradeTotal;
  const profitAmount = quoteBeforeMarkup * toNumber(quoteInputs.profitMarkupPercent);
  const totalQuote = quoteBeforeMarkup + profitAmount;
  const contractorDeposit =
    totalQuote * toNumber(quoteInputs.contractorDepositPercent);
  const contractorBidTarget =
    totalQuote * toNumber(quoteInputs.contractorBidPercent);
  const contractorExpectedProfit =
    contractorBidTarget * toNumber(quoteInputs.contractorProfitPercent);

  return {
    quoteInputs,
    selectedUpgrades,
    selectedTunnelUpgrades,
    baseCostItems,
    squareFeet: roundMoney(squareFeet),
    oneCarpenterBuildDays,
    crewBuildDays,
    totalBuildDays,
    laborHoursPerCarpenter,
    totalCrewLaborHours,
    materialTotal: roundMoney(materialTotal),
    laborTotal: roundMoney(laborTotal),
    baseCostTotal: roundMoney(baseCostTotal),
    upgradeTotal: roundMoney(upgradeTotal),
    tunnelUpgradeTotal: roundMoney(tunnelUpgradeTotal),
    quoteBeforeMarkup: roundMoney(quoteBeforeMarkup),
    profitAmount: roundMoney(profitAmount),
    totalQuote: roundMoney(totalQuote),
    costPerSquareFoot: squareFeet > 0 ? roundMoney(totalQuote / squareFeet) : 0,
    contractorDeposit: roundMoney(contractorDeposit),
    contractorBidTarget: roundMoney(contractorBidTarget),
    contractorExpectedProfit: roundMoney(contractorExpectedProfit),
    contractorCostTarget: roundMoney(contractorBidTarget - contractorExpectedProfit),
    upgradeExtraHours: sumItemHours(selectedUpgrades, "extraHours"),
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
