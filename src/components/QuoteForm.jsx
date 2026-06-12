import {
  PROJECT_COMPLEXITY_OPTIONS,
  STATE_OPTIONS,
} from "../data/defaults.js";
import { formatCurrency } from "../lib/quoteCalculator.js";

function NumberField({
  displayDecimals,
  label,
  name,
  value,
  min = 0,
  step = "any",
  onChange,
}) {
  const displayValue =
    typeof value === "number" && Number.isFinite(value) && displayDecimals !== undefined
      ? value.toFixed(displayDecimals)
      : value;

  return (
    <label className="field">
      <span>{label}</span>
      <input
        min={min}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        step={step}
        type="number"
        value={displayValue}
      />
    </label>
  );
}

const localPricingStatusLabels = {
  checking: "Checking",
  error: "Check failed",
  idle: "Ready",
  updated: "Updated",
};

export default function QuoteForm({ inputs, localPricingStatus, onChange, quote }) {
  return (
    <section className="panel quote-form">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project</p>
          <h2>Quote Inputs</h2>
        </div>
        <span className="count-pill">
          {localPricingStatusLabels[localPricingStatus] ?? "Ready"}
        </span>
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
          <span>Complexity</span>
          <select
            name="complexityLevel"
            onChange={(event) => onChange("complexityLevel", event.target.value)}
            value={inputs.complexityLevel}
          >
            {PROJECT_COMPLEXITY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Deck base</span>
          <select
            name="includeDeckBase"
            onChange={(event) =>
              onChange("includeDeckBase", event.target.value === "true")
            }
            value={String(inputs.includeDeckBase)}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
      </div>

      <div className="field-grid compact">
        <NumberField
          label="Length"
          name="lengthFeet"
          onChange={onChange}
          step="0.25"
          value={inputs.lengthFeet}
        />
        <NumberField
          label="Width"
          name="widthFeet"
          onChange={onChange}
          step="0.25"
          value={inputs.widthFeet}
        />
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
          label="Catio bf/sq ft"
          name="catioBoardFeetPerSquareFoot"
          onChange={onChange}
          step="0.01"
          value={inputs.catioBoardFeetPerSquareFoot}
        />
        <NumberField
          label="Catio non-lumber"
          name="catioNonLumberCostPerSquareFoot"
          onChange={onChange}
          step="0.01"
          value={inputs.catioNonLumberCostPerSquareFoot}
        />
        {inputs.includeDeckBase ? (
          <>
            <NumberField
              label="Deck bf/sq ft"
              name="catioDeckBaseBoardFeetPerSquareFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.catioDeckBaseBoardFeetPerSquareFoot}
            />
            <NumberField
              label="Deck non-lumber"
              name="catioDeckBaseNonLumberCostPerSquareFoot"
              onChange={onChange}
              step="0.01"
              value={inputs.catioDeckBaseNonLumberCostPerSquareFoot}
            />
          </>
        ) : null}
        <NumberField
          label="Markup"
          name="profitMarkupPercent"
          onChange={onChange}
          step="0.01"
          value={inputs.profitMarkupPercent}
        />
        <div className="wall-area">
          <span>Catio rate</span>
          <strong>{formatCurrency(quote.materialPricing.catioMaterialRate)} / sq ft</strong>
        </div>
        {inputs.includeDeckBase ? (
          <div className="wall-area">
            <span>Deck rate</span>
            <strong>
              {formatCurrency(quote.materialPricing.catioDeckBaseMaterialRate)} / sq ft
            </strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}
