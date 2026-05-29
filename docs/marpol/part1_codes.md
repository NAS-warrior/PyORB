# ORB Part I — Operation Codes

Reference: MARPOL Annex I, Regulation 17 and Resolution MEPC.312(74)
Applies to: All vessels of 400 GT and above.

## Code A — Ballasting or Cleaning of Fuel Oil Tanks

Record when ballasting fuel oil tanks or cleaning them before taking ballast.
State: tank identity, position of vessel, quantity of water pumped in (m³).

Applicable tanks: fuel_oil, ballast

## Code B — Cleaning of Fuel Oil Tanks

Record cleaning of fuel oil tanks including cleaning water discharged ashore.
State: tank identity, method of cleaning, quantity of residue.

Applicable tanks: fuel_oil

## Code C — Discharge of Dirty Ballast or Cleaning Water

Record discharge overboard or to reception facilities.
State: tank identity, position, quantity discharged (m³), method.

Applicable tanks: fuel_oil, ballast, slop

## Code D — Non-Automated Closing of Valves / Cleaning of Bilge Water

Record cleaning of bilge holding tanks.
State: quantity of bilge water, position, method used.

Applicable tanks: bilge

## Code E — Discharge of Bilge Water

Record discharge of bilge water to sea through OWS or to reception facility.
State: position, rate of discharge (m³/h), PPM reading from ODM, total quantity.

Applicable tanks: bilge, slop

## Code F — Condition of Oil Filtering Equipment

Record condition of the OWS and ODM equipment.
State: malfunction description, repairs carried out, bypass use.

Not tank-specific — record against the OWS/ODM equipment.

## Code G — Accidental or Other Exceptional Discharge

Record any accidental spill or overboard discharge not covered by other codes.
State: time, position, estimated quantity, type of oil, circumstances, action taken.

Applicable tanks: any

## Code H — Bunkering of Fuel Oil or Bulk Lubricating Oil

Record every bunkering operation.
State: port, date, bunker barge/facility name, tank identity, grade of fuel,
quantity received (m³ and metric tons), density, viscosity.

Applicable tanks: fuel_oil, diesel_oil, lubricating_oil

## Code I — Additional Operational Procedures and General Remarks

Record any other operation or procedure required by MARPOL that does not fit
the above codes, or general remarks relevant to the ORB.

Applicable tanks: any
