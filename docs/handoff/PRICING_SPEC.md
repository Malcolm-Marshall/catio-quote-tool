# Pricing Spec

This is the logic handoff for rebuilding the quote tool from scratch. It captures
the current decisions about what affects price, what was intentionally removed,
and how catio and enclosed patio quotes are calculated.

## Core Decisions

- Do not include labor-hour based pricing.
- Do not include tunnel upgrades or tunnel length.
- Do not include UI fields that do not change the quote.
- Quote math should focus on size, material, complexity, selected upgrades, and fixed costs.
- State and ZIP update local lumber prices.
- Live lumber prices should come from Unwrangle over Lowe's product pages by default.
- Lumber futures are blended into local lumber prices before they are used in formulas.
- Pressure-treated lumber is the base catio material.
- Cedar and redwood catio lumber upgrades are dynamic. They price the difference between selected lumber and pressure-treated lumber, multiplied by total catio board feet.
- Trex decking should not be selected by default.
- Catio deck base is a yes/no input. When included, it is priced from the catio footprint area.

## Removed Inputs

These were intentionally removed because they were no longer part of the pricing model:

- Labor hours, build days, crew size, hourly rate, square feet per day, travel days, day breaks.
- Tunnel upgrades and tunnel feet.
- Customer name.
- Build type when it does not affect formula selection.
- Catio roof selector when it does not affect price.
- Catio height when it does not affect price.
- Included shelf count for catio when it does not affect price.
- Contractor target outputs when they do not affect the customer quote total.
- Enclosed patio wall labels.
- Enclosed patio default wall height, because each wall row has its own height.

## Shared Lumber Pricing

Live or fallback lumber prices provide:

- `pressureTreatedLumberPricePerBoardFoot`
- `cedarLumberPricePerBoardFoot`
- `redwoodLumberPricePerBoardFoot`
- `localLumberPriceSource`
- `localLumberPriceMarket`
- `localLumberPriceCheckedAt`
- `localLumberPriceDetails`

Raw provider details may include:

- returned item price
- board feet per item
- converted price per board foot
- product URL or product ID

Futures adjustment:

```txt
futuresMovementPercent =
  (lumberFuturesPricePerThousandBoardFeet - baselineLumberFuturesPricePerThousandBoardFeet)
  / baselineLumberFuturesPricePerThousandBoardFeet

futuresMultiplier =
  max(0, 1 + futuresMovementPercent * lumberFuturesBlendPercent)

adjustedLumberPricePerBoardFoot =
  localLumberPricePerBoardFoot * futuresMultiplier

materialWasteMultiplier =
  1 + materialWastePercent
```

Default futures inputs:

```txt
lumberFuturesPricePerThousandBoardFeet = 575
baselineLumberFuturesPricePerThousandBoardFeet = 575
lumberFuturesBlendPercent = 0.25
materialWastePercent = 0.12
```

## Catio Inputs

Include these user-editable or pricing-relevant inputs:

- `state`
- `zipCode`
- `complexityLevel`
- `lengthFeet`
- `widthFeet`
- `includeDeckBase`
- pressure-treated, cedar, and redwood local lumber price per board foot
- lumber futures price per thousand board feet
- baseline lumber futures price per thousand board feet
- futures blend percent
- material waste percent
- `catioBoardFeetPerSquareFoot`
- `catioNonLumberCostPerSquareFoot`
- `catioDeckBaseBoardFeetPerSquareFoot`
- `catioDeckBaseNonLumberCostPerSquareFoot`
- `profitMarkupPercent`
- `selectedUpgradeIds`

Default catio values:

```txt
state = OH
zipCode = 43215
complexityLevel = standard
lengthFeet = 10
widthFeet = 10
includeDeckBase = false
pressureTreatedLumberPricePerBoardFoot = 1.15
cedarLumberPricePerBoardFoot = 3.5
redwoodLumberPricePerBoardFoot = 5.25
catioBoardFeetPerSquareFoot = 4
catioNonLumberCostPerSquareFoot = 45
catioDeckBaseBoardFeetPerSquareFoot = 1.6
catioDeckBaseNonLumberCostPerSquareFoot = 24
profitMarkupPercent = 0.38
selectedUpgradeIds = []
```

## Catio Formula

```txt
squareFeet = lengthFeet * widthFeet

catioBoardFeet =
  squareFeet * catioBoardFeetPerSquareFoot * materialWasteMultiplier

catioMaterialRate =
  catioNonLumberCostPerSquareFoot
  + adjustedPressureTreatedLumberPricePerBoardFoot
    * catioBoardFeetPerSquareFoot
    * materialWasteMultiplier

catioMaterialTotal = squareFeet * catioMaterialRate

deckBaseSquareFeet = includeDeckBase ? squareFeet : 0

catioDeckBaseBoardFeet =
  deckBaseSquareFeet
  * catioDeckBaseBoardFeetPerSquareFoot
  * materialWasteMultiplier

catioDeckBaseMaterialRate =
  catioDeckBaseNonLumberCostPerSquareFoot
  + adjustedPressureTreatedLumberPricePerBoardFoot
    * catioDeckBaseBoardFeetPerSquareFoot
    * materialWasteMultiplier

deckBaseTotal = deckBaseSquareFeet * catioDeckBaseMaterialRate

materialTotal = catioMaterialTotal + deckBaseTotal
```

Complexity:

```txt
complexityMultiplier = max(selectedComplexity.multiplier, 1)
complexityTotal = materialTotal * (complexityMultiplier - 1)
```

Catio lumber upgrades:

```txt
totalCatioBoardFeet = catioBoardFeet + catioDeckBaseBoardFeet

cedarUpgradePrice =
  max(adjustedCedarLumberPricePerBoardFoot - adjustedPressureTreatedLumberPricePerBoardFoot, 0)
  * totalCatioBoardFeet

redwoodUpgradePrice =
  max(adjustedRedwoodLumberPricePerBoardFoot - adjustedPressureTreatedLumberPricePerBoardFoot, 0)
  * totalCatioBoardFeet
```

Static catio upgrades:

```txt
upgradeTotal = sum(selected upgrade prices)
```

Final catio quote:

```txt
baseCostTotal =
  catioMaterialTotal
  + deckBaseTotal
  + complexityTotal
  + all fixed job costs

quoteBeforeMarkup = baseCostTotal + upgradeTotal
profitAmount = quoteBeforeMarkup * profitMarkupPercent
totalQuote = quoteBeforeMarkup + profitAmount
costPerSquareFoot = totalQuote / squareFeet
```

## Catio Complexity Options

```txt
standard = 1
moderate = 1.15
complex = 1.3
custom = 1.5
```

## Fixed Catio Job Costs

These are always included in the catio base cost. Amounts may be edited in the
new app's defaults.

```txt
Flights = 512.96
Rental truck = 774.36
Luggage = 0
Gas = 163.18
Food = 324.93
Hotel = 2246.89
Dump = 0
Project manager = 525
Catio designer = 850
Short-term debt = 0
Search engine optimization = 5
Mailchimp and Google Business Manager = 3
Website services = 40.01
Marketing = 218.9
Offsite tool storage = 701.13
New tools = 19.48
Unemployment insurance = 351.34
Workers comp and business insurance = 31.35
```

## Catio Upgrade Rules

- Preserve the static upgrade list, but keep it separate from the quote formula.
- The selected static upgrade prices add before markup.
- Cedar and redwood lumber upgrade prices are dynamic and should override their static placeholder values.
- Only one lumber upgrade should be selected at a time: cedar or redwood.
- Trex decking is available as an upgrade but should not be selected by default.

## Enclosed Patio Inputs

Include these user-editable or pricing-relevant inputs:

- `state`
- `zipCode`
- `patioStyle`
- `lumberMaterial`
- `lengthFeet`
- `widthFeet`
- `walls`
- `needsRoof`
- `doorCount`
- `shelfCount`
- `includeTrim`
- `includeCatDoor`
- `includeDeckBase`
- pressure-treated, cedar, and redwood local lumber price per board foot
- lumber futures price per thousand board feet
- baseline lumber futures price per thousand board feet
- futures blend percent
- material waste percent
- wall, roof, deck base, and trim board-foot assumptions
- wall, roof, deck base, and trim non-lumber rates
- door, shelf, and cat door prices
- `overheadPercent`
- `profitMarkupPercent`

Default enclosed patio values:

```txt
patioStyle = screened-patio
lumberMaterial = pressure-treated
lengthFeet = 14
widthFeet = 12
walls = [
  { widthFeet: 14, heightFeet: 8, quantity: 2 },
  { widthFeet: 12, heightFeet: 8, quantity: 2 }
]
needsRoof = false
doorCount = 1
shelfCount = 4
includeTrim = true
includeCatDoor = true
includeDeckBase = false
wallBoardFeetPerSquareFoot = 1.35
roofBoardFeetPerSquareFoot = 0.75
deckBaseBoardFeetPerSquareFoot = 1.6
trimBoardFeetPerLinearFoot = 0.5
wallNonLumberCostPerSquareFoot = 25
roofNonLumberCostPerSquareFoot = 10
deckBaseNonLumberCostPerSquareFoot = 24
trimNonLumberCostPerLinearFoot = 4
doorPrice = 650
shelfPrice = 70
catDoorPrice = 250
overheadPercent = 0.08
profitMarkupPercent = 0.38
```

## Enclosed Patio Formula

```txt
floorSquareFeet = lengthFeet * widthFeet

wallSquareFeet for each wall =
  wall.widthFeet * wall.heightFeet * wall.quantity

wallLinearFeet for each wall =
  wall.widthFeet * wall.quantity

enclosureSquareFeet = sum(wallSquareFeet)
wallLinearFeet = sum(wallLinearFeet)
roofSquareFeet = needsRoof ? floorSquareFeet : 0
deckBaseSquareFeet = includeDeckBase ? floorSquareFeet : 0
```

Rates:

```txt
wallMaterialRate =
  wallNonLumberCostPerSquareFoot
  + adjustedSelectedLumberPricePerBoardFoot
    * wallBoardFeetPerSquareFoot
    * materialWasteMultiplier

roofMaterialRate =
  roofNonLumberCostPerSquareFoot
  + adjustedSelectedLumberPricePerBoardFoot
    * roofBoardFeetPerSquareFoot
    * materialWasteMultiplier

deckBaseMaterialRate =
  deckBaseNonLumberCostPerSquareFoot
  + adjustedSelectedLumberPricePerBoardFoot
    * deckBaseBoardFeetPerSquareFoot
    * materialWasteMultiplier

trimMaterialRate =
  trimNonLumberCostPerLinearFoot
  + adjustedSelectedLumberPricePerBoardFoot
    * trimBoardFeetPerLinearFoot
    * materialWasteMultiplier
```

Totals:

```txt
wallTotal =
  enclosureSquareFeet * wallMaterialRate * patioStyle.wallMultiplier

roofTotal =
  roofSquareFeet * roofMaterialRate * patioStyle.roofMultiplier

deckBaseTotal =
  deckBaseSquareFeet * deckBaseMaterialRate * patioStyle.deckBaseMultiplier

doorTotal = doorCount * doorPrice
shelfTotal = shelfCount * shelfPrice
trimTotal = includeTrim ? wallLinearFeet * trimMaterialRate : 0
catDoorTotal = includeCatDoor ? catDoorPrice : 0

directSubtotal =
  wallTotal
  + roofTotal
  + deckBaseTotal
  + doorTotal
  + shelfTotal
  + trimTotal
  + catDoorTotal

overheadTotal = directSubtotal * overheadPercent
quoteBeforeMarkup = directSubtotal + overheadTotal
profitAmount = quoteBeforeMarkup * profitMarkupPercent
totalQuote = quoteBeforeMarkup + profitAmount
costPerFloorSquareFoot = totalQuote / floorSquareFeet
costPerEnclosureSquareFoot = totalQuote / enclosureSquareFeet
```

## Enclosed Patio Style Multipliers

```txt
screened-patio:
  wallMultiplier = 1
  roofMultiplier = 1
  deckBaseMultiplier = 1

existing-porch-conversion:
  wallMultiplier = 0.85
  roofMultiplier = 0.85
  deckBaseMultiplier = 0.9

premium-cat-safe-enclosure:
  wallMultiplier = 1.25
  roofMultiplier = 1.15
  deckBaseMultiplier = 1.1
```

## Rounding

Current calculator behavior rounds money-like outputs to two decimals:

```txt
roundMoney(value) = Math.round((Number(value) + Number.EPSILON) * 100) / 100
```

Use `pricing-fixtures.json` as the acceptance test file for the new app.
