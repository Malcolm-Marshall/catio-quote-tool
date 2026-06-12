import { useEffect, useMemo, useState } from "react";
import "./App.css";
import EnclosedPatioCalculator from "./components/EnclosedPatioCalculator.jsx";
import QuoteForm from "./components/QuoteForm.jsx";
import QuoteSummary from "./components/QuoteSummary.jsx";
import UpgradeSelector from "./components/UpgradeSelector.jsx";
import {
  DEFAULT_ENCLOSED_PATIO_INPUTS,
  DEFAULT_QUOTE_INPUTS,
} from "./data/defaults.js";
import {
  calculateEnclosedPatioQuote,
  calculateQuote,
} from "./lib/quoteCalculator.js";
import { getLocalLumberPricesForLocation } from "./lib/localLumberPricing.js";

const numericFields = new Set([
  "lengthFeet",
  "widthFeet",
  "profitMarkupPercent",
  "catioBoardFeetPerSquareFoot",
  "catioNonLumberCostPerSquareFoot",
  "catioDeckBaseBoardFeetPerSquareFoot",
  "catioDeckBaseNonLumberCostPerSquareFoot",
  "doorCount",
  "shelfCount",
  "pressureTreatedLumberPricePerBoardFoot",
  "cedarLumberPricePerBoardFoot",
  "redwoodLumberPricePerBoardFoot",
  "lumberFuturesPricePerThousandBoardFeet",
  "baselineLumberFuturesPricePerThousandBoardFeet",
  "lumberFuturesBlendPercent",
  "materialWastePercent",
  "wallBoardFeetPerSquareFoot",
  "roofBoardFeetPerSquareFoot",
  "deckBaseBoardFeetPerSquareFoot",
  "trimBoardFeetPerLinearFoot",
  "wallNonLumberCostPerSquareFoot",
  "roofNonLumberCostPerSquareFoot",
  "deckBaseNonLumberCostPerSquareFoot",
  "trimNonLumberCostPerLinearFoot",
  "doorPrice",
  "shelfPrice",
  "catDoorPrice",
  "overheadPercent",
]);

const LUMBER_UPGRADE_IDS = new Set([
  "catio-cedar-lumber",
  "catio-redwood-lumber",
]);

const applyLocalLumberPricing = (inputs, localPricing) => ({
  ...inputs,
  state: localPricing.state,
  zipCode: localPricing.zipCode,
  ...localPricing.prices,
  localLumberPriceSource: localPricing.source,
  localLumberPriceMarket: localPricing.market,
  localLumberPriceCheckedAt: localPricing.checkedAt,
  localLumberPriceDetails: localPricing.details ?? {},
});

export default function App() {
  const [activePage, setActivePage] = useState("catio");
  const [inputs, setInputs] = useState(DEFAULT_QUOTE_INPUTS);
  const [patioInputs, setPatioInputs] = useState(DEFAULT_ENCLOSED_PATIO_INPUTS);
  const [quoteLocalPricingStatus, setQuoteLocalPricingStatus] = useState("checking");
  const [patioLocalPricingStatus, setPatioLocalPricingStatus] = useState("checking");
  const quote = useMemo(() => calculateQuote(inputs), [inputs]);
  const patioQuote = useMemo(
    () => calculateEnclosedPatioQuote(patioInputs),
    [patioInputs],
  );

  useEffect(() => {
    let isCurrentRequest = true;

    getLocalLumberPricesForLocation({
      state: inputs.state,
      zipCode: inputs.zipCode,
    })
      .then((localPricing) => {
        if (!isCurrentRequest) {
          return;
        }

        setInputs((currentInputs) => {
          if (
            currentInputs.state !== inputs.state ||
            currentInputs.zipCode !== inputs.zipCode
          ) {
            return currentInputs;
          }

          return applyLocalLumberPricing(currentInputs, localPricing);
        });
        setQuoteLocalPricingStatus("updated");
      })
      .catch(() => {
        if (isCurrentRequest) {
          setQuoteLocalPricingStatus("error");
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [inputs.state, inputs.zipCode]);

  useEffect(() => {
    let isCurrentRequest = true;

    getLocalLumberPricesForLocation({
      state: patioInputs.state,
      zipCode: patioInputs.zipCode,
    })
      .then((localPricing) => {
        if (!isCurrentRequest) {
          return;
        }

        setPatioInputs((currentInputs) => {
          if (
            currentInputs.state !== patioInputs.state ||
            currentInputs.zipCode !== patioInputs.zipCode
          ) {
            return currentInputs;
          }

          return applyLocalLumberPricing(currentInputs, localPricing);
        });
        setPatioLocalPricingStatus("updated");
      })
      .catch(() => {
        if (isCurrentRequest) {
          setPatioLocalPricingStatus("error");
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [patioInputs.state, patioInputs.zipCode]);

  const updateInput = (name, value) => {
    if (name === "state" || name === "zipCode") {
      setQuoteLocalPricingStatus("checking");
    }

    setInputs((currentInputs) => ({
      ...currentInputs,
      [name]: numericFields.has(name) ? Number(value) : value,
    }));
  };

  const updatePatioInput = (name, value) => {
    if (name === "state" || name === "zipCode") {
      setPatioLocalPricingStatus("checking");
    }

    setPatioInputs((currentInputs) => ({
      ...currentInputs,
      [name]: numericFields.has(name) ? Number(value) : value,
    }));
  };

  const resetQuoteInputs = () => {
    setQuoteLocalPricingStatus("checking");
    getLocalLumberPricesForLocation({
      state: DEFAULT_QUOTE_INPUTS.state,
      zipCode: DEFAULT_QUOTE_INPUTS.zipCode,
    })
      .then((localPricing) => {
        setInputs(applyLocalLumberPricing(DEFAULT_QUOTE_INPUTS, localPricing));
        setQuoteLocalPricingStatus("updated");
      })
      .catch(() => {
        setInputs(DEFAULT_QUOTE_INPUTS);
        setQuoteLocalPricingStatus("error");
      });
  };

  const resetPatioInputs = () => {
    setPatioLocalPricingStatus("checking");
    getLocalLumberPricesForLocation({
      state: DEFAULT_ENCLOSED_PATIO_INPUTS.state,
      zipCode: DEFAULT_ENCLOSED_PATIO_INPUTS.zipCode,
    })
      .then((localPricing) => {
        setPatioInputs(
          applyLocalLumberPricing(DEFAULT_ENCLOSED_PATIO_INPUTS, localPricing),
        );
        setPatioLocalPricingStatus("updated");
      })
      .catch(() => {
        setPatioInputs(DEFAULT_ENCLOSED_PATIO_INPUTS);
        setPatioLocalPricingStatus("error");
      });
  };

  const toggleSelectedId = (fieldName, id) => {
    setInputs((currentInputs) => {
      const selectedIds = currentInputs[fieldName] ?? [];
      const isSelected = selectedIds.includes(id);
      const nextIds = isSelected
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id];
      const normalizedNextIds =
        fieldName === "selectedUpgradeIds" && !isSelected && LUMBER_UPGRADE_IDS.has(id)
          ? nextIds.filter(
              (selectedId) => selectedId === id || !LUMBER_UPGRADE_IDS.has(selectedId),
            )
          : nextIds;

      return {
        ...currentInputs,
        [fieldName]: normalizedNextIds,
      };
    });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Sky Catio</p>
          <h1>
            {activePage === "catio" ? "Catio Quote Tool" : "Enclosed Patio Calculator"}
          </h1>
        </div>
        <div className="header-actions">
          <nav className="page-tabs" aria-label="Calculator pages">
            <button
              className={activePage === "catio" ? "active" : ""}
              onClick={() => setActivePage("catio")}
              type="button"
            >
              Catio
            </button>
            <button
              className={activePage === "enclosed-patio" ? "active" : ""}
              onClick={() => setActivePage("enclosed-patio")}
              type="button"
            >
              Enclosed Patio
            </button>
          </nav>
          <button
            className="secondary-button"
            onClick={() =>
              activePage === "catio"
                ? resetQuoteInputs()
                : resetPatioInputs()
            }
          >
            Reset
          </button>
        </div>
      </header>

      {activePage === "catio" ? (
        <main className="workspace">
          <div className="main-column">
            <QuoteForm
              inputs={inputs}
              localPricingStatus={quoteLocalPricingStatus}
              onChange={updateInput}
              quote={quote}
            />
            <UpgradeSelector
              onToggleUpgrade={(id) => toggleSelectedId("selectedUpgradeIds", id)}
              selectedUpgradeIds={inputs.selectedUpgradeIds}
              upgrades={quote.availableUpgrades}
            />
          </div>

          <QuoteSummary quote={quote} />
        </main>
      ) : (
        <EnclosedPatioCalculator
          inputs={patioInputs}
          localPricingStatus={patioLocalPricingStatus}
          onChange={updatePatioInput}
          quote={patioQuote}
        />
      )}
    </div>
  );
}
