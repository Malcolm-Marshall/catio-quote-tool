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

export default function QuoteSummary({ quote }) {
  const selectedOptions = [
    ...quote.selectedUpgrades,
    ...quote.selectedTunnelUpgrades,
  ];
  const visibleBaseCosts = quote.baseCostItems.filter((item) => item.amount > 0);

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
          label="Build days"
          value={formatNumber(quote.totalBuildDays)}
        />
        <Metric
          label="Labor hours"
          value={formatNumber(quote.totalCrewLaborHours)}
        />
        <Metric
          label="Upgrade hours"
          value={formatNumber(quote.upgradeExtraHours)}
        />
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
          <CostRow label="Tunnel upgrades" value={quote.tunnelUpgradeTotal} />
          <CostRow label="Before markup" value={quote.quoteBeforeMarkup} />
          <CostRow label="Markup" value={quote.profitAmount} />
          <CostRow label="Total quote" value={quote.totalQuote} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Contractor</p>
            <h2>Targets</h2>
          </div>
        </div>

        <div className="cost-list">
          <CostRow label="Ask for job" value={quote.contractorDeposit} />
          <CostRow label="Bid target" value={quote.contractorBidTarget} />
          <CostRow
            label="Expected contractor profit"
            value={quote.contractorExpectedProfit}
          />
          <CostRow label="Cost target" value={quote.contractorCostTarget} />
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
