import { PROJECT_TYPE_OPTIONS } from "../data/defaults.js";

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

export default function QuoteForm({ inputs, onChange }) {
  return (
    <section className="panel quote-form">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project</p>
          <h2>Quote Inputs</h2>
        </div>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Customer</span>
          <input
            name="customerName"
            onChange={(event) => onChange("customerName", event.target.value)}
            type="text"
            value={inputs.customerName}
          />
        </label>

        <label className="field">
          <span>State</span>
          <input
            name="state"
            onChange={(event) => onChange("state", event.target.value)}
            type="text"
            value={inputs.state}
          />
        </label>

        <label className="field">
          <span>Build type</span>
          <select
            name="projectType"
            onChange={(event) => onChange("projectType", event.target.value)}
            value={inputs.projectType}
          >
            {PROJECT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Roof</span>
          <select
            name="needsRoof"
            onChange={(event) => onChange("needsRoof", event.target.value === "true")}
            value={String(inputs.needsRoof)}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
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
        <NumberField
          label="Height"
          name="heightFeet"
          onChange={onChange}
          step="0.25"
          value={inputs.heightFeet}
        />
        <NumberField
          label="Tunnel feet"
          name="tunnelFeet"
          onChange={onChange}
          step="0.25"
          value={inputs.tunnelFeet}
        />
        <NumberField
          label="Shelves included"
          name="includedShelves"
          onChange={onChange}
          step="1"
          value={inputs.includedShelves}
        />
        <NumberField
          label="Carpenters"
          name="carpenterCount"
          onChange={onChange}
          step="1"
          value={inputs.carpenterCount}
        />
      </div>

      <div className="field-grid compact">
        <NumberField
          label="Sq ft per day"
          name="squareFeetPerDay"
          onChange={onChange}
          step="0.25"
          value={inputs.squareFeetPerDay}
        />
        <NumberField
          label="Labor hours/day"
          name="laborHoursPerBuildDay"
          onChange={onChange}
          step="0.25"
          value={inputs.laborHoursPerBuildDay}
        />
        <NumberField
          displayDecimals={2}
          label="Hourly rate"
          name="contractorHourlyRate"
          onChange={onChange}
          step="0.01"
          value={inputs.contractorHourlyRate}
        />
        <NumberField
          label="Material $/sq ft"
          name="materialCostPerSquareFoot"
          onChange={onChange}
          step="0.01"
          value={inputs.materialCostPerSquareFoot}
        />
        <NumberField
          label="Markup"
          name="profitMarkupPercent"
          onChange={onChange}
          step="0.01"
          value={inputs.profitMarkupPercent}
        />
        <NumberField
          label="Day breaks"
          name="dayBreaks"
          onChange={onChange}
          step="0.25"
          value={inputs.dayBreaks}
        />
      </div>
    </section>
  );
}
