import {
  ENCLOSED_PATIO_STYLE_OPTIONS,
  LUMBER_MATERIAL_OPTIONS,
  STATE_OPTIONS,
} from "../data/defaults.js";
import { formatCurrency, formatNumber } from "../lib/quoteCalculator.js";

function NumberField({
  label,
  min = 0,
  name,
  onChange,
  step = "any",
  value,
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        min={min}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

function ToggleField({ checked, label, name, onChange }) {
  return (
    <label className="toggle-field">
      <input
        checked={checked}
        onChange={(event) => onChange(name, event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

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

const numericWallFields = new Set(["widthFeet", "heightFeet", "quantity"]);

const localPricingStatusLabels = {
  checking: "Checking",
  error: "Check failed",
  idle: "Ready",
  updated: "Updated",
};

const formatCheckedAt = (value) => {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

const formatMarket = (market, zipCode) =>
  zipCode ? `${market} ${zipCode}` : market;

export default function EnclosedPatioCalculator({
  inputs,
  localPricingStatus,
  onChange,
  quote,
}) {
  const visibleCosts = quote.directCostItems.filter((item) => item.amount > 0);
  const lumberDetails = inputs.localLumberPriceDetails ?? {};
  const walls = inputs.walls ?? [];

  const updateWall = (id, fieldName, value) => {
    const nextWalls = walls.map((wall) =>
      wall.id === id
        ? {
            ...wall,
            [fieldName]: numericWallFields.has(fieldName) ? Number(value) : value,
          }
        : wall,
    );

    onChange("walls", nextWalls);
  };

  const addWall = () => {
    const nextWall = {
      id: `patio-wall-${Date.now()}`,
      widthFeet: inputs.lengthFeet,
      heightFeet: walls[0]?.heightFeet ?? 8,
      quantity: 1,
    };

    onChange("walls", [...walls, nextWall]);
  };

  const removeWall = (id) => {
    onChange(
      "walls",
      walls.filter((wall) => wall.id !== id),
    );
  };

  return (
    <main className="workspace patio-workspace">
      <div className="main-column">
        <section className="panel quote-form">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Enclosed Patio</p>
              <h2>Patio Inputs</h2>
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>State</span>
              <select
                name="state"
                onChange={(event) => onChange("state", event.target.value)}
                value={inputs.state}
              >
                {STATE_OPTIONS.map((state) => (
                  <option key={state.value} value={state.value}>
                    {state.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>ZIP code</span>
              <input
                inputMode="numeric"
                maxLength="5"
                name="zipCode"
                onChange={(event) => onChange("zipCode", event.target.value)}
                pattern="[0-9]{5}"
                type="text"
                value={inputs.zipCode}
              />
            </label>

            <label className="field">
              <span>Patio style</span>
              <select
                name="patioStyle"
                onChange={(event) => onChange("patioStyle", event.target.value)}
                value={inputs.patioStyle}
              >
                {ENCLOSED_PATIO_STYLE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Lumber material</span>
              <select
                name="lumberMaterial"
                onChange={(event) => onChange("lumberMaterial", event.target.value)}
                value={inputs.lumberMaterial}
              >
                {LUMBER_MATERIAL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Roof needed</span>
              <select
                name="needsRoof"
                onChange={(event) => onChange("needsRoof", event.target.value === "true")}
                value={String(inputs.needsRoof)}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </label>
          </div>

          <div className="field-grid compact">
            <NumberField
              label="Deck length"
              name="lengthFeet"
              onChange={onChange}
              step="0.25"
              value={inputs.lengthFeet}
            />
            <NumberField
              label="Deck width"
              name="widthFeet"
              onChange={onChange}
              step="0.25"
              value={inputs.widthFeet}
            />
            <NumberField
              label="Doors"
              name="doorCount"
              onChange={onChange}
              step="1"
              value={inputs.doorCount}
            />
            <NumberField
              label="Shelves"
              name="shelfCount"
              onChange={onChange}
              step="1"
              value={inputs.shelfCount}
            />
            <NumberField
              label="Markup"
              name="profitMarkupPercent"
              onChange={onChange}
              step="0.01"
              value={inputs.profitMarkupPercent}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Wall Sizes</p>
              <h2>Wall Sections</h2>
            </div>
            <button className="secondary-button compact-button" onClick={addWall} type="button">
              Add Wall
            </button>
          </div>

          <div className="wall-list">
            {walls.map((wall) => {
              const calculatedArea =
                Number(wall.widthFeet) *
                Number(wall.heightFeet) *
                Number(wall.quantity);

              return (
                <div className="wall-row" key={wall.id}>
                  <NumberField
                    label="Width"
                    name="widthFeet"
                    onChange={(_, value) => updateWall(wall.id, "widthFeet", value)}
                    step="0.25"
                    value={wall.widthFeet}
                  />
                  <NumberField
                    label="Height"
                    name="heightFeet"
                    onChange={(_, value) => updateWall(wall.id, "heightFeet", value)}
                    step="0.25"
                    value={wall.heightFeet}
                  />
                  <NumberField
                    label="Qty"
                    name="quantity"
                    onChange={(_, value) => updateWall(wall.id, "quantity", value)}
                    step="1"
                    value={wall.quantity}
                  />
                  <div className="wall-area">
                    <span>Area</span>
                    <strong>{formatNumber(calculatedArea)} sq ft</strong>
                  </div>
                  <button
                    className="danger-button"
                    onClick={() => removeWall(wall.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Pricing</p>
              <h2>Rates and Allowances</h2>
            </div>
            <span className="count-pill">
              {localPricingStatusLabels[localPricingStatus] ?? "Ready"}
            </span>
          </div>

          <div className="field-grid compact">
            <NumberField
              label="Pressure treated $/bf"
              name="pressureTreatedLumberPricePerBoardFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.pressureTreatedLumberPricePerBoardFoot}
            />
            <NumberField
              label="Cedar $/bf"
              name="cedarLumberPricePerBoardFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.cedarLumberPricePerBoardFoot}
            />
            <NumberField
              label="Redwood $/bf"
              name="redwoodLumberPricePerBoardFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.redwoodLumberPricePerBoardFoot}
            />
            <NumberField
              label="Futures $/mbf"
              name="lumberFuturesPricePerThousandBoardFeet"
              onChange={onChange}
              step="0.01"
              value={inputs.lumberFuturesPricePerThousandBoardFeet}
            />
            <NumberField
              label="Baseline $/mbf"
              name="baselineLumberFuturesPricePerThousandBoardFeet"
              onChange={onChange}
              step="0.01"
              value={inputs.baselineLumberFuturesPricePerThousandBoardFeet}
            />
            <NumberField
              label="Futures blend"
              name="lumberFuturesBlendPercent"
              onChange={onChange}
              step="0.01"
              value={inputs.lumberFuturesBlendPercent}
            />
            <NumberField
              label="Waste"
              name="materialWastePercent"
              onChange={onChange}
              step="0.01"
              value={inputs.materialWastePercent}
            />
          </div>

          <div className="field-grid compact">
            <NumberField
              label="Wall bf/sq ft"
              name="wallBoardFeetPerSquareFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.wallBoardFeetPerSquareFoot}
            />
            <NumberField
              label="Roof bf/sq ft"
              name="roofBoardFeetPerSquareFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.roofBoardFeetPerSquareFoot}
            />
            <NumberField
              label="Deck bf/sq ft"
              name="deckBaseBoardFeetPerSquareFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.deckBaseBoardFeetPerSquareFoot}
            />
            <NumberField
              label="Trim bf/ft"
              name="trimBoardFeetPerLinearFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.trimBoardFeetPerLinearFoot}
            />
            <NumberField
              label="Wall non-lumber"
              name="wallNonLumberCostPerSquareFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.wallNonLumberCostPerSquareFoot}
            />
            <NumberField
              label="Roof non-lumber"
              name="roofNonLumberCostPerSquareFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.roofNonLumberCostPerSquareFoot}
            />
            <NumberField
              label="Deck non-lumber"
              name="deckBaseNonLumberCostPerSquareFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.deckBaseNonLumberCostPerSquareFoot}
            />
            <NumberField
              label="Trim non-lumber"
              name="trimNonLumberCostPerLinearFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.trimNonLumberCostPerLinearFoot}
            />
            <NumberField
              label="Door price"
              name="doorPrice"
              onChange={onChange}
              step="0.01"
              value={inputs.doorPrice}
            />
            <NumberField
              label="Shelf price"
              name="shelfPrice"
              onChange={onChange}
              step="0.01"
              value={inputs.shelfPrice}
            />
            <NumberField
              label="Cat door"
              name="catDoorPrice"
              onChange={onChange}
              step="0.01"
              value={inputs.catDoorPrice}
            />
            <NumberField
              label="Overhead"
              name="overheadPercent"
              onChange={onChange}
              step="0.01"
              value={inputs.overheadPercent}
            />
          </div>

          <div className="toggle-grid">
            <ToggleField
              checked={inputs.includeTrim}
              label="Include finishing trim"
              name="includeTrim"
              onChange={onChange}
            />
            <ToggleField
              checked={inputs.includeCatDoor}
              label="Include cat door"
              name="includeCatDoor"
              onChange={onChange}
            />
            <ToggleField
              checked={inputs.includeDeckBase}
              label="Include full deck base"
              name="includeDeckBase"
              onChange={onChange}
            />
          </div>
        </section>
      </div>

      <aside className="summary">
        <section className="panel total-panel">
          <p className="eyebrow">Patio Quote</p>
          <strong>{formatCurrency(quote.totalQuote)}</strong>
          <span>
            {formatCurrency(quote.costPerFloorSquareFoot)} per floor sq ft
          </span>
        </section>

        <section className="panel metrics-grid">
          <Metric
            label="Floor sq ft"
            value={formatNumber(quote.floorSquareFeet)}
          />
          <Metric
            label="Wall sq ft"
            value={formatNumber(quote.enclosureSquareFeet)}
          />
          <Metric label="Roof sq ft" value={formatNumber(quote.roofSquareFeet)} />
          <Metric label="Wall linear ft" value={`${formatNumber(quote.wallLinearFeet)} ft`} />
        </section>

        <section className="panel metrics-grid">
          <Metric label="Lumber" value={quote.selectedLumberMaterial.label} />
          <Metric
            label="Market"
            value={formatMarket(inputs.localLumberPriceMarket, inputs.zipCode)}
          />
          <Metric
            label="Adjusted $/bf"
            value={formatCurrency(quote.materialPricing.adjustedLumberPricePerBoardFoot)}
          />
          <Metric
            label="Provider $/bf"
            value={formatCurrency(quote.materialPricing.localLumberPricePerBoardFoot)}
          />
          <Metric
            label="Futures move"
            value={`${formatNumber(quote.materialPricing.futuresMovementPercent * 100)}%`}
          />
          <Metric
            label="Futures blend"
            value={`${formatNumber(quote.materialPricing.futuresBlendPercent * 100)}%`}
          />
          <Metric
            label="Price check"
            value={formatCheckedAt(inputs.localLumberPriceCheckedAt)}
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
            <CostRow label="Direct subtotal" value={quote.directSubtotal} />
            <CostRow label="Overhead" value={quote.overheadTotal} />
            <CostRow label="Before markup" value={quote.quoteBeforeMarkup} />
            <CostRow label="Markup" value={quote.profitAmount} />
            <CostRow label="Total quote" value={quote.totalQuote} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Materials</p>
              <h2>Derived Rates</h2>
            </div>
          </div>

          <div className="cost-list compact-list">
            <DetailRow
              label="Provider"
              value={inputs.localLumberPriceSource}
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
              label="Wall rate / sq ft"
              value={quote.materialPricing.wallMaterialRate}
            />
            <CostRow
              label="Roof rate / sq ft"
              value={quote.materialPricing.roofMaterialRate}
            />
            <CostRow
              label="Deck rate / sq ft"
              value={quote.materialPricing.deckBaseMaterialRate}
            />
            <CostRow
              label="Trim rate / ft"
              value={quote.materialPricing.trimMaterialRate}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Costs</p>
              <h2>Included Items</h2>
            </div>
          </div>

          <div className="cost-list compact-list">
            {visibleCosts.map((item) => (
              <CostRow key={item.id} label={item.label} value={item.amount} />
            ))}
          </div>
        </section>
      </aside>
    </main>
  );
}
