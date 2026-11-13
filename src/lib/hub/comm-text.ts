// Generated from the finished mock-up (Main.dc.html): the commercial service agreement's 19 clauses, the specialist works
// agreement's 17, the 6 preset scopes (seeded into scope_presets too) and each specialist service's standard method lines.
// Word for word. Edit with care: signed agreements keep the clauses they were signed with.

export interface Clause { n: number; t: string; b: string }
export interface PresetScope { id: string; name: string; note: string; sow: { heading: string; items: string[] }[] }

export const COMM_CLAUSES: Clause[] = [
 {
  "n": 1,
  "t": "Definitions & Interpretation",
  "b": "Agreement means these terms, the Schedule of Particulars and Schedules. Services means the cleaning services in Schedule 1 and the accepted Proposal. Premises means the site in the Particulars. Fees means the Service Fee payable by the Client. GST has the meaning in the A New Tax System (Goods and Services Tax) Act 1999 (Cth). Headings are for convenience only; the singular includes the plural; a reference to a party includes its successors and permitted assigns."
 },
 {
  "n": 2,
  "t": "Engagement & Term",
  "b": "The Client engages the Provider to perform the Services at the Premises from the Commencement Date. This Agreement continues for the Initial Term and then automatically on a rolling basis on the same terms until terminated under clause 14. The Provider performs the Services as an independent contractor; nothing in this Agreement creates a partnership, joint venture or employment relationship."
 },
 {
  "n": 3,
  "t": "Scope of Services & Variations",
  "b": "The Provider will perform the Services described in Schedule 1 and the accepted Proposal. Any change to the scope, frequency or standard of the Services must be agreed in writing and may result in an adjustment to the Fees. Additional or ad hoc tasks are quoted separately and require prior notice."
 },
 {
  "n": 4,
  "t": "Service Standards & Quality",
  "b": "The Provider will perform the Services with due care and skill, using trained and supervised personnel, to a professional commercial standard and in compliance with all applicable laws. The Provider operates quality-assurance systems and conducts periodic site audits. Where the Client reports a deficiency in the Services within a reasonable time, the Provider will rectify it at the next scheduled service at no additional cost."
 },
 {
  "n": 5,
  "t": "Fees, Invoicing & Payment",
  "b": "The Client will pay the Fees specified in the Particulars. The Provider invoices by email monthly, and invoices are due within the payment period stated in the Particulars. Late payment incurs a 10% late fee plus 2% monthly interest on the overdue balance. The Provider may suspend the Services where invoices remain unpaid beyond 14 days after written reminder. All amounts include GST unless stated otherwise."
 },
 {
  "n": 6,
  "t": "GST",
  "b": "Unless expressly stated otherwise, amounts payable under this Agreement include GST. The Provider will issue a valid tax invoice for each taxable supply."
 },
 {
  "n": 7,
  "t": "Annual Price Review",
  "b": "The Provider may adjust the Fees once per year in line with the Queensland Consumer Price Index, on a minimum of 30 days' written notice. The Fees may also be reviewed by agreement where there is a material change in scope, frequency, site conditions, consumable costs or applicable award wages."
 },
 {
  "n": 8,
  "t": "Client Responsibilities",
  "b": "The Client will provide safe and secure access to the Premises, including keys, fobs or access codes, prior to commencement; supply power, water and lighting at no charge; notify the Provider of any site-specific hazards or requirements in advance; secure cash, valuables and confidential materials; and supply client-provided consumables unless otherwise agreed."
 },
 {
  "n": 9,
  "t": "Materials & Equipment",
  "b": "The Provider supplies all cleaning equipment and products required to perform the Services. Safety Data Sheets are available on request at no cost. The Provider's products and methods comply with relevant Australian standards and the Provider's environmental management obligations."
 },
 {
  "n": 10,
  "t": "Workplace Health & Safety",
  "b": "Both parties will comply with the Work Health and Safety Act 2011 (Qld) and related regulations. The Client will provide a safe working environment and disclose known hazards; the Provider's personnel will observe site safety rules and the Provider's safe-work procedures. Each party will report incidents affecting the other without delay."
 },
 {
  "n": 11,
  "t": "Insurance",
  "b": "The Provider maintains public liability insurance of not less than $20 million, personal accident and income protection cover, and any other insurance relevant to the Services. Where the Provider engages workers, it will hold workers' compensation insurance as required by law. Certificates of currency are available to the Client on request."
 },
 {
  "n": 12,
  "t": "Confidentiality & Privacy",
  "b": "Each party will keep the other's confidential information secret and use it only for the purposes of this Agreement. The Provider handles personal information in accordance with the Privacy Act 1988 (Cth). All Provider personnel are bound by confidentiality obligations and handle client credentials and site information with discretion."
 },
 {
  "n": 13,
  "t": "Subcontracting & Assignment",
  "b": "The Provider may subcontract performance of the Services but remains responsible for the Services performed. Neither party may assign its rights under this Agreement without the other's prior written consent, which will not be unreasonably withheld."
 },
 {
  "n": 14,
  "t": "Suspension & Termination",
  "b": "After the Initial Term, either party may terminate this Agreement by giving 14 days' written notice. Either party may terminate immediately if the other commits a material breach not remedied within 14 days of written notice, or becomes insolvent. Early termination by the Client before the end of the Initial Term may incur a fee equivalent to one month's Service Fee. On termination, the Client will pay for Services performed to the termination date and the Provider will return all keys, fobs and access devices."
 },
 {
  "n": 15,
  "t": "Personnel & Non-Solicitation",
  "b": "The Provider is responsible for the recruitment, vetting, training and induction of its personnel. For three (3) years from the Commencement Date, the Client will not solicit or employ any Provider personnel engaged in the Services without the Provider's written consent or payment of a reasonable recruitment fee."
 },
 {
  "n": 16,
  "t": "Liability & Indemnity",
  "b": "Each party indemnifies the other against loss arising from its own negligence or breach of this Agreement. To the extent permitted by law, neither party is liable for indirect or consequential loss, and the Provider's total liability is limited to the Fees paid in the 12 months before the relevant claim. The Provider is not liable for pre-existing damage, fair wear and tear, or loss arising from the Client's failure to provide access, information or a safe site. Nothing in this clause limits rights that cannot be excluded under the Australian Consumer Law."
 },
 {
  "n": 17,
  "t": "Force Majeure",
  "b": "Neither party is liable for any delay or failure to perform caused by an event beyond its reasonable control. Affected obligations are suspended for the duration of the event, and either party may terminate if the event continues for more than 30 days."
 },
 {
  "n": 18,
  "t": "Dispute Resolution",
  "b": "The parties will attempt in good faith to resolve any dispute by negotiation between senior representatives, and will participate in mediation before commencing litigation, except where urgent injunctive relief is required."
 },
 {
  "n": 19,
  "t": "General",
  "b": "This Agreement is governed by the laws of Queensland and the parties submit to the courts of that State. It constitutes the entire agreement between the parties and supersedes prior discussions. Any variation must be in writing and signed by both parties. A failure to enforce a term is not a waiver of it. If any provision is unenforceable, it is severed and the remainder continues in force. Notices must be in writing and sent to the addresses in the Particulars. This Agreement may be executed in counterparts and by electronic signature."
 }
]

export const SPEC_CLAUSES: Clause[] = [
 {
  "n": 1,
  "t": "Definitions & Interpretation",
  "b": "Agreement means these terms, the Schedule of Particulars and Schedules. Works means the specialist cleaning works in Schedule 1 and the accepted Proposal. Premises means the site in the Particulars. Fees means the Works Price payable by the Client. GST has the meaning in the A New Tax System (Goods and Services Tax) Act 1999 (Cth). Headings are for convenience only; the singular includes the plural; a reference to a party includes its successors and permitted assigns."
 },
 {
  "n": 2,
  "t": "Engagement",
  "b": "The Client engages the Provider to perform the Works at the Premises on the Works Date, or another date the parties agree in writing. The Provider performs the Works as an independent contractor; nothing in this Agreement creates a partnership, joint venture or employment relationship. This Agreement ends once the Works are completed and the Fees are paid."
 },
 {
  "n": 3,
  "t": "Scope of Works & Variations",
  "b": "The Provider will perform the Works described in Schedule 1 and the accepted Proposal. The Fees are based on the areas and condition described. If the size or condition of an area differs materially on the day, the Provider will confirm any change to the Fees with the Client before continuing. Any change to the Works must be agreed in writing."
 },
 {
  "n": 4,
  "t": "Service Standards & Quality",
  "b": "The Provider will perform the Services with due care and skill, using trained and supervised personnel, to a professional commercial standard and in compliance with all applicable laws. The Provider operates quality-assurance systems and conducts periodic site audits. Where the Client reports a deficiency in the Services within a reasonable time, the Provider will rectify it at the next scheduled service at no additional cost."
 },
 {
  "n": 5,
  "t": "Fees, Invoicing & Payment",
  "b": "The Client will pay the Fees specified in the Particulars. The Provider invoices by email on completion of the Works, and invoices are due within 14 days. Late payment incurs a 10% late fee plus 2% monthly interest on the overdue balance. All amounts include GST unless stated otherwise."
 },
 {
  "n": 6,
  "t": "GST",
  "b": "Unless expressly stated otherwise, amounts payable under this Agreement include GST. The Provider will issue a valid tax invoice for each taxable supply."
 },
 {
  "n": 7,
  "t": "Client Responsibilities",
  "b": "The Client will provide safe and secure access to the Premises, including keys, fobs or access codes, prior to commencement; supply power, water and lighting at no charge; notify the Provider of any site-specific hazards or requirements in advance; secure cash, valuables and confidential materials; and supply client-provided consumables unless otherwise agreed."
 },
 {
  "n": 8,
  "t": "Materials & Equipment",
  "b": "The Provider supplies all cleaning equipment and products required to perform the Services. Safety Data Sheets are available on request at no cost. The Provider's products and methods comply with relevant Australian standards and the Provider's environmental management obligations."
 },
 {
  "n": 9,
  "t": "Workplace Health & Safety",
  "b": "Both parties will comply with the Work Health and Safety Act 2011 (Qld) and related regulations. The Client will provide a safe working environment and disclose known hazards; the Provider's personnel will observe site safety rules and the Provider's safe-work procedures. Each party will report incidents affecting the other without delay."
 },
 {
  "n": 10,
  "t": "Insurance",
  "b": "The Provider maintains public liability insurance of not less than $20 million, personal accident and income protection cover, and any other insurance relevant to the Services. Where the Provider engages workers, it will hold workers' compensation insurance as required by law. Certificates of currency are available to the Client on request."
 },
 {
  "n": 11,
  "t": "Confidentiality & Privacy",
  "b": "Each party will keep the other's confidential information secret and use it only for the purposes of this Agreement. The Provider handles personal information in accordance with the Privacy Act 1988 (Cth). All Provider personnel are bound by confidentiality obligations and handle client credentials and site information with discretion."
 },
 {
  "n": 12,
  "t": "Subcontracting & Assignment",
  "b": "The Provider may subcontract performance of the Services but remains responsible for the Services performed. Neither party may assign its rights under this Agreement without the other's prior written consent, which will not be unreasonably withheld."
 },
 {
  "n": 13,
  "t": "Personnel & Non-Solicitation",
  "b": "The Provider is responsible for the recruitment, vetting, training and induction of its personnel. For three (3) years from the Commencement Date, the Client will not solicit or employ any Provider personnel engaged in the Services without the Provider's written consent or payment of a reasonable recruitment fee."
 },
 {
  "n": 14,
  "t": "Liability & Indemnity",
  "b": "Each party indemnifies the other against loss arising from its own negligence or breach of this Agreement. To the extent permitted by law, neither party is liable for indirect or consequential loss, and the Provider's total liability is limited to the Fees paid in the 12 months before the relevant claim. The Provider is not liable for pre-existing damage, fair wear and tear, or loss arising from the Client's failure to provide access, information or a safe site. Nothing in this clause limits rights that cannot be excluded under the Australian Consumer Law."
 },
 {
  "n": 15,
  "t": "Force Majeure",
  "b": "Neither party is liable for any delay or failure to perform caused by an event beyond its reasonable control. Affected obligations are suspended for the duration of the event, and either party may terminate if the event continues for more than 30 days."
 },
 {
  "n": 16,
  "t": "Dispute Resolution",
  "b": "The parties will attempt in good faith to resolve any dispute by negotiation between senior representatives, and will participate in mediation before commencing litigation, except where urgent injunctive relief is required."
 },
 {
  "n": 17,
  "t": "General",
  "b": "This Agreement is governed by the laws of Queensland and the parties submit to the courts of that State. It constitutes the entire agreement between the parties and supersedes prior discussions. Any variation must be in writing and signed by both parties. A failure to enforce a term is not a waiver of it. If any provision is unenforceable, it is severed and the remainder continues in force. Notices must be in writing and sent to the addresses in the Particulars. This Agreement may be executed in counterparts and by electronic signature."
 }
]

export const PRESETS: PresetScope[] = [
 {
  "id": "office",
  "name": "Office",
  "note": "Your standard template scope",
  "sow": [
   {
    "heading": "Reception & Throughout",
    "items": [
     "Floors vacuumed & mopped",
     "All surfaces wiped down",
     "Computer screens cleaned",
     "Bins emptied & relined"
    ]
   },
   {
    "heading": "Kitchenette",
    "items": [
     "Benchtops & sink cleaned",
     "Exterior of appliances wiped",
     "Floors mopped"
    ]
   },
   {
    "heading": "Bathrooms",
    "items": [
     "Toilets cleaned & sanitised",
     "Vanity, mirrors & sinks",
     "Floors mopped"
    ]
   }
  ]
 },
 {
  "id": "clinic",
  "name": "Medical or allied health clinic",
  "note": "GP, physio, dental, consulting rooms",
  "sow": [
   {
    "heading": "Reception & Waiting Room",
    "items": [
     "Floors vacuumed & mopped",
     "Counters, chairs & surfaces wiped down",
     "High-touch points sanitised (handles, switches, EFTPOS, rails)",
     "Bins emptied & relined"
    ]
   },
   {
    "heading": "Consulting & Treatment Rooms",
    "items": [
     "Treatment beds & chairs wiped with disinfectant",
     "Hand basins & tapware cleaned",
     "Floors mopped with disinfectant",
     "General waste emptied (no clinical or sharps waste)"
    ]
   },
   {
    "heading": "Kitchenette",
    "items": [
     "Benchtops & sink cleaned",
     "Exterior of appliances wiped",
     "Floors mopped"
    ]
   },
   {
    "heading": "Bathrooms",
    "items": [
     "Toilets cleaned & sanitised",
     "Vanity, mirrors & sinks",
     "Floors mopped"
    ]
   }
  ]
 },
 {
  "id": "childcare",
  "name": "Childcare or early learning",
  "note": "Play rooms, nappy change, kitchen",
  "sow": [
   {
    "heading": "Play Rooms",
    "items": [
     "Floors vacuumed & mopped",
     "Tables & chairs wiped & sanitised",
     "Low surfaces & door handles sanitised",
     "Bins emptied & relined"
    ]
   },
   {
    "heading": "Nappy Change & Children’s Bathrooms",
    "items": [
     "Toilets & basins cleaned & sanitised",
     "Change benches sanitised",
     "Floors mopped with disinfectant"
    ]
   },
   {
    "heading": "Kitchenette",
    "items": [
     "Benchtops & sink cleaned",
     "Exterior of appliances wiped",
     "Floors mopped"
    ]
   },
   {
    "heading": "Bathrooms",
    "items": [
     "Toilets cleaned & sanitised",
     "Vanity, mirrors & sinks",
     "Floors mopped"
    ]
   }
  ]
 },
 {
  "id": "gym",
  "name": "Gym or fitness studio",
  "note": "Gym floor, change rooms, showers",
  "sow": [
   {
    "heading": "Gym Floor",
    "items": [
     "Floors vacuumed & mopped",
     "Equipment touch points wiped (handles, seats, benches)",
     "Mirrors cleaned",
     "Bins emptied & relined"
    ]
   },
   {
    "heading": "Change Rooms & Showers",
    "items": [
     "Showers cleaned & sanitised",
     "Benches & lockers wiped down",
     "Floors mopped with disinfectant"
    ]
   },
   {
    "heading": "Bathrooms",
    "items": [
     "Toilets cleaned & sanitised",
     "Vanity, mirrors & sinks",
     "Floors mopped"
    ]
   }
  ]
 },
 {
  "id": "warehouse",
  "name": "Warehouse or industrial",
  "note": "Offices, lunchroom, amenities",
  "sow": [
   {
    "heading": "Offices",
    "items": [
     "Desks & surfaces wiped down",
     "Floors vacuumed & mopped",
     "Bins emptied & relined"
    ]
   },
   {
    "heading": "Lunchroom",
    "items": [
     "Benchtops & sink cleaned",
     "Tables & chairs wiped",
     "Exterior of appliances wiped",
     "Floors mopped"
    ]
   },
   {
    "heading": "Amenities",
    "items": [
     "Toilets & urinals cleaned & sanitised",
     "Basins & mirrors cleaned",
     "Floors mopped"
    ]
   },
   {
    "heading": "Warehouse Floor",
    "items": [
     "Accessible floor areas swept (outside racking)"
    ]
   }
  ]
 },
 {
  "id": "retail",
  "name": "Retail shop",
  "note": "Shop floor and back of house",
  "sow": [
   {
    "heading": "Shop Floor",
    "items": [
     "Floors vacuumed & mopped",
     "Counters & displays dusted (stock not handled)",
     "Entry glass & doors cleaned",
     "Bins emptied & relined"
    ]
   },
   {
    "heading": "Back of House",
    "items": [
     "Staff room benchtops & sink cleaned",
     "Floors mopped"
    ]
   },
   {
    "heading": "Bathrooms",
    "items": [
     "Toilets cleaned & sanitised",
     "Vanity, mirrors & sinks",
     "Floors mopped"
    ]
   }
  ]
 }
]

export const SPEC_METHODS: Record<string, string[]> = {
 "Carpet steam clean": [
  "Pre-vacuum of all carpeted areas",
  "Pre-spray of traffic lanes and marks",
  "Hot water extraction",
  "Spot treatment of stains where possible",
  "Carpet left to dry with airflow"
 ],
 "Vinyl strip and seal": [
  "Furniture moved within the area where practical",
  "Old sealant stripped back",
  "Floor scrubbed and rinsed",
  "Fresh coats of sealer applied",
  "Furniture returned once dry"
 ],
 "Internal windows": [
  "Internal glass cleaned streak-free",
  "Internal window frames wiped down",
  "Window seals wiped and detailed",
  "Window tracks vacuumed and wiped",
  "Window sills wiped down"
 ],
 "Internal & external windows": [
  "Glass cleaned streak-free, inside and out",
  "Window frames wiped down, inside and out",
  "Window seals wiped and detailed, inside and out",
  "Window tracks vacuumed and wiped, inside and out",
  "Window sills wiped down, inside and out"
 ],
 "Window cleaning": [
  "Glass cleaned streak-free, inside and out",
  "Window frames wiped down, inside and out",
  "Window seals wiped and detailed, inside and out",
  "Window tracks vacuumed and wiped, inside and out",
  "Window sills wiped down, inside and out"
 ],
 "Pressure washing": [
  "Loose debris swept from the area",
  "High-pressure clean of the surface",
  "Edges and corners detailed",
  "Area rinsed and left clean"
 ]
}
