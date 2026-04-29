import { useMemo, useState } from "react";
import "./App.css";
import QuoteForm from "./components/QuoteForm.jsx";
import QuoteSummary from "./components/QuoteSummary.jsx";
import UpgradeSelector from "./components/UpgradeSelector.jsx";
import { DEFAULT_QUOTE_INPUTS } from "./data/defaults.js";
import { CATIO_UPGRADES, TUNNEL_UPGRADES } from "./data/upgrades.js";
import { calculateQuote } from "./lib/quoteCalculator.js";

const numericFields = new Set([
  "lengthFeet",
  "widthFeet",
  "heightFeet",
  "tunnelFeet",
  "includedShelves",
  "carpenterCount",
  "squareFeetPerDay",
  "laborHoursPerBuildDay",
  "dayBreaks",
  "travelDays",
  "contractorHourlyRate",
  "materialCostPerSquareFoot",
  "profitMarkupPercent",
  "contractorDepositPercent",
  "contractorBidPercent",
  "contractorProfitPercent",
]);

export default function App() {
  const [inputs, setInputs] = useState(DEFAULT_QUOTE_INPUTS);
  const quote = useMemo(() => calculateQuote(inputs), [inputs]);

  const updateInput = (name, value) => {
    setInputs((currentInputs) => ({
      ...currentInputs,
      [name]: numericFields.has(name) ? Number(value) : value,
    }));
  };

  const toggleSelectedId = (fieldName, id) => {
    setInputs((currentInputs) => {
      const selectedIds = currentInputs[fieldName] ?? [];
      const nextIds = selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id];

      return {
        ...currentInputs,
        [fieldName]: nextIds,
      };
    });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Sky Catio</p>
          <h1>Catio Quote Tool</h1>
        </div>
        <button className="secondary-button" onClick={() => setInputs(DEFAULT_QUOTE_INPUTS)}>
          Reset
        </button>
      </header>

      <main className="workspace">
        <div className="main-column">
          <QuoteForm inputs={inputs} onChange={updateInput} />
          <UpgradeSelector
            onToggleTunnelUpgrade={(id) =>
              toggleSelectedId("selectedTunnelUpgradeIds", id)
            }
            onToggleUpgrade={(id) => toggleSelectedId("selectedUpgradeIds", id)}
            selectedTunnelUpgradeIds={inputs.selectedTunnelUpgradeIds}
            selectedUpgradeIds={inputs.selectedUpgradeIds}
            tunnelUpgrades={TUNNEL_UPGRADES}
            upgrades={CATIO_UPGRADES}
          />
        </div>

        <QuoteSummary quote={quote} />
      </main>
    </div>
  );
}
