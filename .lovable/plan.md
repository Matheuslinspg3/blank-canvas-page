Implement a specialized CRM view for Managers and Admins to audit leads across the entire organization, addressing the request to monitor team productivity and "stale" leads.

### User Interface Changes

- **Manager/Admin View Mode**: Add a "Gestão" (Management) toggle or specialized view for users with `admin` or `manager` roles.
- **Enhanced Filters in CRM**:
  - **Responsible Filter**: Allow filtering by Broker (already exists, but will ensure it works across all leads for admins).
  - **Staleness Filter**: Filter leads that haven't been updated in 7+ or 14+ days.
  - **Criteria Filter**: Filter leads with "Sem Critérios" (missing interest data) to prompt data entry.
- **Advanced Lead Details**:
  - Improve the visualization of UTMs and attribution context in the `LeadDetails` drawer.
  - Show "Lead Score" history and recent activities more prominently.
- **Lead Metrics Upgrade**:
  - Add a "Time to First Action" or "Last Interaction" distribution chart in the metrics section.

### Technical Implementation

- **Data Fetching**: Ensure `useLeadCRUD` fetches all organization leads for admins, not just those assigned to them (current logic already supports this for non-broker roles, but will verify).
- **Staleness Logic**: Standardize the definition of "Stale" (7 days) and "Critical" (14 days) in `src/lib/leadStaleness.ts`.
- **UTM Visualization**: Create a dedicated component for the `attribution_context` JSON field to show Campaign, Source, and Medium clearly.

### Technical Details

- **Files affected**:
  - `src/components/crm/KanbanBoard.tsx`: Main logic for switching between "My Leads" and "Org Audit".
  - `src/components/crm/LeadFilters.tsx`: Adding staleness and criteria filters.
  - `src/components/crm/LeadDetails.tsx`: Better UTM and activity display.
  - `src/hooks/useLeadCRUD.ts`: Verification of admin fetching logic.
  - `src/lib/leadStaleness.ts`: Utility for calculating staleness.
- **Role Permissions**: Utilize `useUserRoles` to gate management features.
