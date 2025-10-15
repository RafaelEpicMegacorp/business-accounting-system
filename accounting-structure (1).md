# Project Structure

## Recommended File Organization

For a production-ready React application, here's the recommended structure:

```
business-accounting-app/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── AccountingApp.jsx          # Main component
│   │   ├── Dashboard.jsx              # Summary cards section
│   │   ├── EntryForm.jsx              # Add/Edit form
│   │   └── EntryTable.jsx             # Data table
│   ├── hooks/
│   │   └── useAccounting.js           # Custom hook for state management
│   ├── utils/
│   │   ├── calculations.js            # Helper functions for totals
│   │   └── formatters.js              # Number/currency formatting
│   ├── data/
│   │   └── initialData.js             # Initial entries data
│   ├── App.jsx                        # Root component
│   ├── index.jsx                      # Entry point
│   └── index.css                      # Global styles (Tailwind)
├── package.json
├── tailwind.config.js
├── vite.config.js (or webpack config)
└── README.md
```

## Current Single-File Implementation

Right now, everything is in one component (`AccountingApp.jsx`). This is fine for a small project but can be refactored later.

## Data Model

### Entry Object Structure
```javascript
{
  id: number,           // Unique identifier (timestamp)
  type: string,         // 'income' or 'expense'
  category: string,     // Category name
  description: string,  // Main description
  detail: string,       // Optional additional info
  baseAmount: number,   // Base amount before taxes/fees
  total: number         // Total amount including taxes/fees
}
```

## Dependencies

### Required NPM Packages
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.263.1"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.0",
    "vite": "^4.4.0"
  }
}
```

## Styling Approach

- **Tailwind CSS**: Utility-first CSS framework
- **Only core utilities**: No custom Tailwind classes (no compiler needed)
- **Inline styles**: All styling done via className prop
- **Responsive**: Mobile-first responsive design with `md:` breakpoints

## State Management

Currently using React's built-in `useState` hooks. For future expansion, consider:
- **Context API**: For sharing state across multiple components
- **Local Storage**: For persisting data between sessions
- **Backend Integration**: API calls to save/load data

## Component Breakdown (Future Refactor)

When splitting into smaller components:

### Dashboard.jsx
```jsx
// Props: totalIncome, totalExpenses, netBalance
// Renders the three summary cards
```

### EntryForm.jsx
```jsx
// Props: onSubmit, onCancel, initialData (for editing), categories
// Renders the add/edit form with all inputs
```

### EntryTable.jsx
```jsx
// Props: entries, onEdit, onDelete
// Renders the table of all entries
```

### useAccounting.js (Custom Hook)
```jsx
// Manages all state and business logic
// Returns: entries, handlers, totals
// Can be imported by AccountingApp.jsx
```