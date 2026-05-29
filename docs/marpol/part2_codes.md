# ORB Part II — Operation Codes

Reference: MARPOL Annex I, Regulations 36 & 37
Applies to: Oil tankers of 150 GT and above, and oil barges.

Part II is only active in PyORB when the vessel type is set to:
oil_tanker, product_tanker, chemical_tanker, or oil_barge.

## Code A — Loading of Oil Cargo

Record every loading operation.
State: port, date, tank identity, type of cargo, quantity loaded (m³).

Applicable tanks: cargo

## Code B — Internal Transfer of Oil Cargo During Voyage

Record transfers between cargo tanks while at sea or in port.
State: tanks involved (from/to), type of cargo, quantity transferred (m³).

Applicable tanks: cargo

## Code C — Unloading of Oil Cargo

Record every discharge of cargo.
State: port, date, tank identity, type of cargo, quantity discharged (m³),
quantity remaining on board.

Applicable tanks: cargo

## Code D — Ballasting of Cargo Tanks and Dedicated Clean Ballast Tanks

Record taking on ballast water in cargo tanks or CBT.
State: tank identity, position, quantity of water (m³).

Applicable tanks: cargo, ballast

## Code E — Cleaning of Cargo Tanks

Record tank cleaning including crude oil washing (COW).
State: tank identity, method used (COW, hot water, chemical), quantity of
cleaning water (m³), disposal method.

Applicable tanks: cargo

## Code F — Discharge of Ballast Water or Cleaning Water from Cargo Tanks

Record discharge of ballast or dirty cleaning water.
State: position, tank identity, quantity discharged (m³), method of
monitoring, oil content at discharge point (PPM).

Applicable tanks: cargo, ballast, slop

## Code G — Accidental or Other Exceptional Discharge

Record any unintentional or emergency discharge of oil cargo or oily water.
State: time, position, estimated quantity, type of oil, circumstances,
action taken to stop and clean up.

Applicable tanks: any
