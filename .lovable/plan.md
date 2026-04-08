

# Plan: Add "Testar Guides" button + fix guide rendering

## Problem

The `guides` state in `Canvas.tsx` exists (line 26) and renders (lines 87-93), but is **never populated** — there is no `onDragMove` handler computing alignment guides during drag. The guides array stays empty forever.

Two things need to happen:
1. Wire up actual guide computation in Canvas (so guides work during real drags too)
2. Add a "Testar guides" QA button that programmatically creates a near-aligned scenario and triggers visible guides

## Changes

### 1. Canvas.tsx — Add `onDragMove` with guide computation + accept external guides prop

- Add `onDragMove` handler to `DndContext` that:
  - Gets the dragged element's proposed position (current layout + delta)
  - Iterates other elements in the same absolute column
  - If `|proposedX - otherX| < 4` or `|proposedY - otherY| < 4`, adds a guide
  - Sets `guides` state with the computed guides
- Add optional `externalGuides` prop so DevQAPanel can inject persistent test guides
- Merge external + drag guides for rendering

### 2. Canvas.tsx — Accept `externalGuides` prop

Add `externalGuides?: { x?: number; y?: number }[]` to Canvas Props. Render them alongside internal guides.

### 3. DevQAPanel.tsx — Add "Testar guides" button

The button will:
1. Find or create a column in absolute mode with 2+ elements
2. Activate absolute on the first column with 2+ elements (dispatches `UPDATE_COLUMN_LAYOUT_MODE`)
3. Position element A at `{ x: 50, y: 80 }`
4. Position element B at `{ x: 53, y: 80 }` (3px difference in X — within the 4px threshold)
5. Select element B
6. Set `externalGuides` to `[{ x: 50 }]` (the alignment line at element A's X)
7. Clear guides after 5 seconds via `setTimeout`

### 4. DevSiteBuilderPro.tsx — Wire external guides state

- Add `const [externalGuides, setExternalGuides] = useState([])` 
- Pass `externalGuides` to Canvas
- Pass `setExternalGuides` to DevQAPanel

### 5. Validate in runtime

After implementation:
- Navigate to `/dev/site-builder-pro`
- Click "Testar guides"
- Screenshot showing red guide line
- Confirm `tsc --noEmit` clean

## Files modified

| File | Change |
|------|--------|
| `src/components/siteBuilderPro/Canvas.tsx` | Add `onDragMove` guide computation + `externalGuides` prop |
| `src/components/siteBuilderPro/DevQAPanel.tsx` | Add "Testar guides" button |
| `src/pages/DevSiteBuilderPro.tsx` | Wire `externalGuides` state between Canvas and DevQAPanel |

