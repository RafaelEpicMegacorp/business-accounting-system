# Wise Sync History - Visual Guide

## Button Location

The "Sync Wise History" button is located in the **Wise Account Balances** section on the Dashboard.

```
┌─────────────────────────────────────────────────────────────┐
│                         DASHBOARD                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Total Wise Balance] [End-of-Month] [Monthly Recurring]   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  💵  Wise Account Balances                                  │
│                                                              │
│      [🔄 Sync Wise History]  [📤 Import CSV]  ←── BUTTONS   │
│                                                              │
│      ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│      │ 🇺🇸 USD  │  │ 🇪🇺 EUR  │  │ 🇵🇱 PLN  │                 │
│      │ 33,592  │  │   128    │  │  7,431   │                 │
│      └─────────┘  └─────────┘  └─────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Button States

### 1. Default State
```
┌──────────────────────────┐
│  🔄  Sync Wise History   │  ← Blue background (bg-blue-600)
└──────────────────────────┘    Hover: Darker blue (bg-blue-700)
                                 Cursor: Pointer
```

### 2. Loading State (During Sync)
```
┌──────────────────────────┐
│  ⟳  Syncing...           │  ← Spinner rotating
└──────────────────────────┘    Button disabled
                                 Opacity: 50%
                                 Cursor: not-allowed
```

### 3. Success State
```
┌──────────────────────────────────────────────────────────┐
│  ✅ Wise Sync Complete                                   │
│                                                           │
│  🇺🇸 USD: 2 new transactions (3,878.38 USD)              │
│  🇪🇺 EUR: 1 new transaction (128.12 EUR)                 │
│  🇵🇱 PLN: 6 new transactions (7,431.11 PLN)              │
│                                                           │
│  Total: 9 transactions imported                          │
└──────────────────────────────────────────────────────────┘
   Green background (bg-green-100)
   Green text (text-green-800)
   Green border (border-green-300)
   Monospace font
   Auto-dismisses after 15 seconds
```

### 4. Success State (All Duplicates)
```
┌──────────────────────────────────────────────────────────┐
│  ✅ Wise Sync Complete                                   │
│  All transactions up to date (9 duplicates skipped)      │
└──────────────────────────────────────────────────────────┘
   Green background
   Simple message
   Auto-dismisses after 15 seconds
```

### 5. Error State
```
┌──────────────────────────────────────────────────────────┐
│  ❌ Failed to sync from Wise                             │
│  Network error: Connection refused                       │
└──────────────────────────────────────────────────────────┘
   Red background (bg-red-100)
   Red text (text-red-800)
   Red border (border-red-300)
   Auto-dismisses after 10 seconds
```

## Visual Flow

### User Journey Diagram
```
    USER
      │
      ├─► Clicks "Sync Wise History"
      │
      ├─► Button shows "Syncing..." + spinner
      │
      ├─► Backend fetches from Wise API
      │
      ├─► Processing transactions
      │
      ├─► Success message appears
      │
      ├─► Dashboard refreshes automatically
      │
      └─► Message auto-dismisses after 15s
```

### Data Flow
```
Frontend Button Click
       │
       ├─► wiseService.syncFromWise()
       │
       ├─► POST /api/wise/sync
       │
       ├─► Backend: Fetch Wise Activities
       │
       ├─► Backend: Process Transactions
       │
       ├─► Backend: Update Database
       │
       ├─► Response: {success, stats, currencyBreakdown}
       │
       ├─► Frontend: Parse Response
       │
       ├─► Frontend: Format Success Message
       │
       ├─► Frontend: Display Message
       │
       ├─► Frontend: Refresh Dashboard
       │
       └─► Frontend: Auto-dismiss After 15s
```

## Color Scheme

### Button Colors
- **Default**: Blue (#2563EB - bg-blue-600)
- **Hover**: Darker Blue (#1D4ED8 - bg-blue-700)
- **Disabled**: Blue at 50% opacity

### Message Colors
- **Success Background**: Light Green (#DCFCE7 - bg-green-100)
- **Success Text**: Dark Green (#166534 - text-green-800)
- **Success Border**: Medium Green (#86EFAC - border-green-300)
- **Error Background**: Light Red (#FEE2E2 - bg-red-100)
- **Error Text**: Dark Red (#991B1B - text-red-800)
- **Error Border**: Medium Red (#FCA5A5 - border-red-300)

## Typography

### Button Text
- **Font**: System default (sans-serif)
- **Size**: Base (16px)
- **Weight**: Medium (500)
- **Icon Size**: 18px

### Success Message
- **Font**: Monospace
- **Size**: Small (14px)
- **Line Height**: 1.5
- **Whitespace**: Pre-line (preserves line breaks)

## Spacing

### Button Layout
```
┌─────────────────────────────────────────┐
│  ◄─ 16px ─►  Icon  ◄─ 8px ─►  Text     │  ◄─ Horizontal padding: 16px
│  ▲                                      │
│  12px padding top/bottom                │
│  ▼                                      │
└─────────────────────────────────────────┘
```

### Message Layout
```
┌─────────────────────────────────────────┐
│  ▲                                      │
│  16px padding                           │
│  ▼                                      │
│  ✅ Wise Sync Complete                 │  ◄─ First line
│                                         │  ◄─ Blank line
│  🇺🇸 USD: 2 new transactions           │  ◄─ Currency lines
│  🇪🇺 EUR: 1 new transaction            │
│                                         │  ◄─ Blank line
│  Total: 9 transactions imported        │  ◄─ Summary line
│  ▲                                      │
│  16px padding                           │
│  ▼                                      │
└─────────────────────────────────────────┘
```

## Animation

### Spinner Animation
```
Frame 1:  🔄  (0°)
Frame 2:  🔄  (90°)
Frame 3:  🔄  (180°)
Frame 4:  🔄  (270°)
Frame 5:  🔄  (360° - loop)
```
**Speed**: Continuous smooth rotation
**CSS Class**: `animate-spin`
**Duration**: ~1 second per rotation

### Message Fade In/Out
```
Appear:  Instant (no fade-in animation)
Display: 15 seconds (success) or 10 seconds (error)
Dismiss: Instant (no fade-out animation)
```

## Responsive Design

### Desktop (≥768px)
```
[Sync Wise History] [Import CSV]  ← Buttons side by side
```

### Mobile (<768px)
```
[Sync Wise History]  ← Full width button
[Import CSV]         ← Full width button
```

## Accessibility

### ARIA Labels
- Button has clear text label
- Icon is decorative (no alt text needed)
- Disabled state communicated via `disabled` attribute

### Keyboard Navigation
- Button focusable with Tab key
- Activatable with Enter or Space
- Disabled during sync (cannot activate)

### Screen Readers
- Button text: "Sync Wise History"
- Loading state: "Syncing..."
- Success message: Read aloud in full
- Error message: Read aloud with emphasis

## Browser Compatibility

### Tested Browsers
- ✅ Chrome 120+ (Full support)
- ✅ Firefox 121+ (Full support)
- ✅ Safari 17+ (Full support)
- ✅ Edge 120+ (Full support)

### CSS Features Used
- Flexbox (Universal support)
- Grid (Universal support)
- CSS animations (Universal support)
- Tailwind CSS classes (Compiled to standard CSS)

## Example Screenshots (Text Description)

### Screenshot 1: Button Location
**Description**: Dashboard view showing Wise Account Balances section with blue "Sync Wise History" button next to teal "Import CSV" button. Three currency cards below showing USD, EUR, PLN balances.

### Screenshot 2: Loading State
**Description**: Same view but "Sync Wise History" button now shows "Syncing..." with spinning icon. Button appears dimmed (50% opacity) and is unclickable.

### Screenshot 3: Success Message (New Transactions)
**Description**: Green success banner appears above currency cards. Shows checkmark emoji, title "Wise Sync Complete", followed by three currency lines with flags and transaction counts, ending with "Total: 9 transactions imported".

### Screenshot 4: Success Message (All Duplicates)
**Description**: Green success banner with simpler message: "All transactions up to date (9 duplicates skipped)". Clean and concise.

### Screenshot 5: Error Message
**Description**: Red error banner appears above currency cards. Shows X emoji, title "Failed to sync from Wise", followed by error details like "Network error: Connection refused".

### Screenshot 6: Updated Dashboard
**Description**: After successful sync, currency balance cards show updated values. Total Wise Balance card reflects new total. Charts below have refreshed with new data points.

## Code Snippets

### Button HTML Structure
```jsx
<button
  onClick={handleWiseSync}
  disabled={syncing}
  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
>
  <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
  {syncing ? 'Syncing...' : 'Sync Wise History'}
</button>
```

### Success Message HTML Structure
```jsx
{syncMessage && (
  <div className="mb-4 p-4 rounded-lg bg-green-100 text-green-800 border border-green-300">
    <div className="whitespace-pre-line font-mono text-sm">
      {syncMessage.text}
    </div>
  </div>
)}
```

## Interaction Patterns

### Click Behavior
1. **First Click**: Triggers sync, button disabled
2. **During Sync**: Click ignored (button disabled)
3. **After Success**: Button re-enables, can sync again
4. **After Error**: Button re-enables, can retry immediately

### Message Timing
- **Success Message**: Appears immediately after sync completion
- **Display Duration**: 15 seconds (enough time to read details)
- **Auto-Dismiss**: Fades away after timeout
- **Manual Dismiss**: No close button (auto-dismiss only)

### Dashboard Refresh
- **Trigger**: Successful sync completion
- **Method**: API calls to refresh data
- **Components Updated**:
  - Currency balance cards
  - Total USD balance
  - Income vs Expense chart
  - Category breakdown chart
- **User Experience**: Seamless update without page reload

## Performance Indicators

### Visual Feedback
- **Immediate**: Button state change (spinner, text)
- **During Sync**: Continuous spinner animation
- **On Completion**: Success/error message appears
- **Post-Sync**: Dashboard data updates visually

### Loading Indicators
- **Button**: Spinner icon rotates
- **Text**: Changes from "Sync Wise History" to "Syncing..."
- **Cursor**: Changes to "not-allowed" when disabled
- **Opacity**: Reduces to 50% during sync

## Edge Cases Visual Handling

### No Internet Connection
```
┌──────────────────────────────────────────────────────────┐
│  ❌ Failed to sync from Wise                             │
│  Network error: Failed to fetch                          │
└──────────────────────────────────────────────────────────┘
```

### API Rate Limit Hit
```
┌──────────────────────────────────────────────────────────┐
│  ❌ Failed to sync from Wise                             │
│  Rate limit exceeded. Please try again later.            │
└──────────────────────────────────────────────────────────┘
```

### Missing Configuration
```
┌──────────────────────────────────────────────────────────┐
│  ❌ Failed to sync from Wise                             │
│  Wise API not configured. Missing WISE_API_TOKEN         │
└──────────────────────────────────────────────────────────┘
```

### Zero Transactions Found
```
┌──────────────────────────────────────────────────────────┐
│  ✅ Wise Sync Complete                                   │
│  All transactions up to date (0 duplicates skipped)      │
└──────────────────────────────────────────────────────────┘
```

## Comparison: Before vs After

### Before (Old Button)
- Text: "Sync from Wise"
- Message: Simple text with transaction counts
- Format: Single line message
- Timeout: 10 seconds
- Info: Basic statistics only

### After (New Button)
- Text: "Sync Wise History" (more descriptive)
- Message: Detailed per-currency breakdown
- Format: Multi-line with currency flags
- Timeout: 15 seconds (more time to read)
- Info: Per-currency stats + balances

## Visual Hierarchy

### Priority Levels
1. **High**: Button (blue, prominent)
2. **High**: Success/Error messages (green/red, full width)
3. **Medium**: Currency cards (below button)
4. **Low**: Other dashboard elements

### Color Contrast
- ✅ Button text on blue: WCAG AA compliant
- ✅ Success text on green: WCAG AA compliant
- ✅ Error text on red: WCAG AA compliant
- ✅ Currency flags: High visibility

## Print Styles

### What Prints
- Dashboard layout (simplified)
- Currency balances (visible)
- Success/error messages (if present)

### What Doesn't Print
- Sync button (hidden - no interaction in print)
- Hover states (not applicable)
- Animations (not applicable)

---

**Document Version**: 1.0
**Last Updated**: October 29, 2025
**Purpose**: Visual reference for UI/UX testing and documentation
