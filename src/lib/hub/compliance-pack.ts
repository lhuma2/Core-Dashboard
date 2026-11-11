// The documents in the compliance pack, in the mock-up's groups (v80). The full text of each comes across
// with the Compliance pack step; the dashboard only needs the count.
export const COMPLIANCE_GROUPS = ['Safe Work Method Statements', 'Policies', 'Contractor onboarding', 'Insurance', 'ABN registration'] as const

export const COMPLIANCE_PACK: { code: string; title: string; group: number }[] = [
  { code: 'SWMS 001', title: 'Commercial Cleaning Operations', group: 0 },
  { code: 'SWMS 002', title: 'Chemical Handling & Storage', group: 0 },
  { code: 'SWMS 003', title: 'Manual Handling', group: 0 },
  { code: 'SWMS 004', title: 'Slip, Trip & Fall Prevention', group: 0 },
  { code: 'SWMS 005', title: 'Pressure Washing', group: 0 },
  { code: 'SWMS 006', title: 'Floor Scrubbing & Polishing', group: 0 },
  { code: 'SWMS 007', title: 'Window Cleaning', group: 0 },
  { code: 'SWMS 008', title: 'Bond Cleaning Operations', group: 0 },
  { code: 'SWMS 009', title: 'Residential Cleaning Operations', group: 0 },
  { code: 'SWMS 010', title: 'Vinyl Floor Strip and Seal', group: 0 },
  { code: 'SWMS 011', title: 'Carpet Steam Cleaning', group: 0 },
  { code: 'POL-002', title: 'Environmental Policy', group: 1 },
  { code: 'POL-003', title: 'Business Continuity Plan', group: 1 },
  { code: 'POLICY', title: 'Modern Slavery Declaration', group: 1 },
  { code: 'SDS-REG', title: 'Safety Data Sheet (SDS) Register', group: 1 },
  { code: 'DCA-SUB', title: 'Subcontractor Services Agreement', group: 2 },
  { code: 'IND-001', title: 'Contractor Induction', group: 2 },
  { code: 'COC', title: 'Certificate of Currency (Public Liability)', group: 3 },
  { code: 'ABN', title: 'ABN Registration (ABN Lookup printout)', group: 4 },
]
