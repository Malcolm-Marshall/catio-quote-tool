import { formatCurrency, formatNumber } from "../lib/quoteCalculator.js";

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CostRow({ label, value }) {
  return (
    <div className="cost-row">
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="cost-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const lumberPriceFields = [
  {
    field: "pressureTreatedLumberPricePerBoardFoot",
    label: "Pressure treated",
  },
  {
    field: "cedarLumberPricePerBoardFoot",
    label: "Cedar",
  },
  {
    field: "redwoodLumberPricePerBoardFoot",
    label: "Redwood",
  },
];

function ProviderProductRows({ details }) {
  const providerRows = lumberPriceFields
    .map((material) => ({
      ...material,
      detail: details?.[material.field],
    }))
    .filter(({ detail }) => Number.isFinite(Number(detail?.itemPrice)));

  if (providerRows.length === 0) {
    return null;
  }

  return providerRows.map(({ detail, field, label }) => {
    const boardFeet = Number(detail.boardFeet);
    const detailText = Number.isFinite(boardFeet)
      ? `${formatCurrency(detail.itemPrice)} / ${formatNumber(boardFeet)} bf item`
      : formatCurrency(detail.itemPrice);

    return (
      <DetailRow
        key={field}
        label={`${label} returned item`}
        value={detailText}
      />
    );
  });
}

export default function QuoteSummary({ quote }) {
  const selectedOptions = quote.selectedUpgrades;
  const visibleBaseCosts = quote.baseCostItems.filter((item) => item.amount > 0);
  const lumberDetails = quote.quoteInputs.localLumberPriceDetails ?? {};

  return (
    <aside className="summary">
      <section className="panel total-panel">
        <p className="eyebrow">Customer Price</p>
        <strong>{formatCurrency(quote.totalQuote)}</strong>
        <span>{formatCurrency(quote.costPerSquareFoot)} per sq ft</span>
      </section>

      <section className="panel metrics-grid">
        <Metric label="Square feet" value={formatNumber(quote.squareFeet)} />
        <Metric
          label="Material rate"
          value={`${formatCurrency(quote.materialPricing.catioMaterialRate)} / sq ft`}
        />
        <Metric
          label="Lumber market"
          value={`${quote.quoteInputs.localLumberPriceMarket} ${quote.quoteInputs.zipCode}`}
        />
        <Metric
          label="Complexity"
          value={quote.selectedComplexity.label}
        />
        <Metric
          label="Selected options"
          value={formatNumber(selectedOptions.length, 0)}
        />
        {quote.deckBaseTotal > 0 ? (
          <Metric label="Deck base" value={formatCurrency(quote.deckBaseTotal)} />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Quote</p>
            <h2>Breakdown</h2>
          </div>
        </div>

        <div className="cost-list">
          <CostRow label="Base costs" value={quote.baseCostTotal} />
          <CostRow label="Catio upgrades" value={quote.upgradeTotal} />
          <CostRow label="Before markup" value={quote.quoteBeforeMarkup} />
          <CostRow label="Markup" value={quote.profitAmount} />
          <CostRow label="Total quote" value={quote.totalQuote} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Costs</p>
            <h2>Job Inputs</h2>
          </div>
        </div>

        <div className="cost-list compact-list">
          {visibleBaseCosts.map((item) => (
            <CostRow key={item.id} label={item.label} value={item.amount} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Materials</p>
            <h2>Lumber Pricing</h2>
          </div>
        </div>

        <div className="cost-list compact-list">
          <DetailRow
            label="Provider"
            value={quote.quoteInputs.localLumberPriceSource}
          />
          <ProviderProductRows details={lumberDetails} />
          <CostRow
            label="Provider pressure treated / bf"
            value={quote.materialPricing.localPressureTreatedLumberPricePerBoardFoot}
          />
          <CostRow
            label="Provider cedar / bf"
            value={quote.materialPricing.localCedarLumberPricePerBoardFoot}
          />
          <CostRow
            label="Provider redwood / bf"
            value={quote.materialPricing.localRedwoodLumberPricePerBoardFoot}
          />
          <CostRow
            label="Adjusted pressure treated / bf"
            value={quote.materialPricing.adjustedPressureTreatedLumberPricePerBoardFoot}
          />
          <CostRow
            label="Adjusted cedar / bf"
            value={quote.materialPricing.adjustedCedarLumberPricePerBoardFoot}
          />
          <CostRow
            label="Adjusted redwood / bf"
            value={quote.materialPricing.adjustedRedwoodLumberPricePerBoardFoot}
          />
          <div className="cost-row">
            <span>Catio board feet</span>
            <strong>{formatNumber(quote.materialPricing.catioBoardFeet)} bf</strong>
          </div>
          {quote.deckBaseTotal > 0 ? (
            <>
              <DetailRow
                label="Deck base area"
                value={`${formatNumber(quote.deckBaseSquareFeet)} sq ft`}
              />
              <DetailRow
                label="Deck base board feet"
                value={`${formatNumber(quote.materialPricing.catioDeckBaseBoardFeet)} bf`}
              />
              <DetailRow
                label="Total lumber board feet"
                value={`${formatNumber(quote.materialPricing.totalCatioBoardFeet)} bf`}
              />
            </>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Selected</p>
            <h2>Options</h2>
          </div>
        </div>

        {selectedOptions.length > 0 ? (
          <div className="selected-list">
            {selectedOptions.map((option) => (
              <div className="selected-option" key={option.id}>
                <span>{option.name}</span>
                <strong>{formatCurrency(option.price)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No upgrades selected</p>
        )}
      </section>
    </aside>
  );
}
