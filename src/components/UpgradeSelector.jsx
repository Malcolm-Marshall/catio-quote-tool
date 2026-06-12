import { formatCurrency } from "../lib/quoteCalculator.js";

function UpgradeList({ title, upgrades, selectedIds, onToggle }) {
  return (
    <section className="panel upgrade-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Options</p>
          <h2>{title}</h2>
        </div>
        <span className="count-pill">{selectedIds.length} selected</span>
      </div>

      <div className="upgrade-list">
        {upgrades.map((upgrade) => {
          const isSelected = selectedIds.includes(upgrade.id);

          return (
            <label
              className={`upgrade-row${isSelected ? " selected" : ""}`}
              key={upgrade.id}
            >
              <input
                checked={isSelected}
                onChange={() => onToggle(upgrade.id)}
                type="checkbox"
              />
              <span className="upgrade-copy">
                <span>{upgrade.name}</span>
                <small>{formatCurrency(upgrade.price)}</small>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export default function UpgradeSelector({
  upgrades,
  selectedUpgradeIds,
  onToggleUpgrade,
}) {
  return (
    <div className="upgrade-grid">
      <UpgradeList
        onToggle={onToggleUpgrade}
        selectedIds={selectedUpgradeIds}
        title="Catio Upgrades"
        upgrades={upgrades}
      />
    </div>
  );
}
