# JavaScript Modules Structure

This directory contains the modular JavaScript architecture for AllmightyConversion.

## File Organization

### Core Files

#### `utils.js`
- **Purpose**: Core utility functions used across all modules
- **Exports**: `window.AllmightyUtils`
- **Key Functions**:
  - `formatFileSize()` - Format file sizes for display
  - `escapeHtml()` - Prevent XSS attacks
  - `formatValue()` - Format values for display
  - `tryParseJson()` - Safe JSON string parsing
  - `showError()` / `showSuccess()` - User feedback messages
  - `switchTab()` - Tab navigation
  - `downloadFile()` - File download functionality
  - `clearAll()` - Reset application state

#### `main.js`
- **Purpose**: Application entry point and module management
- **Exports**: `window.AllmightyConversion`
- **Key Features**:
  - Module registration system
  - Application initialization
  - Error handling setup
  - Debug logging
  - Welcome message display

### Module Files

#### `json-to-table.js`
- **Purpose**: JSON to table conversion functionality
- **Exports**: `window.JsonToTable`
- **Key Features**:
  - Complete JSON flattening (objects, arrays, JSON strings)
  - Table generation with dot/bracket notation
  - CSV export functionality
  - File upload handling
  - Statistics calculation

#### `table-to-json.js`
- **Purpose**: Table to JSON conversion (placeholder)
- **Exports**: `window.TableToJson`
- **Status**: Coming soon

## Module System

### Registration
```javascript
window.AllmightyConversion.registerModule('module-id', {
    name: 'Module Name',
    init: () => { /* initialization code */ },
    required: true // or false
});
```

### Initialization
Each module should export an `init()` function that will be called automatically when the application loads.

### Module Structure Template
```javascript
/**
 * Module Name Module
 * Description of what this module does
 */

// Initialize the module
function initModuleName() {
    // Module initialization code
    console.log('Module initialized');
}

// Main functionality
function mainFunction() {
    // Core module logic
}

// Export functions for global access
window.ModuleName = {
    init: initModuleName,
    main: mainFunction
};
```

## Loading Order

1. `utils.js` - Core utilities (must load first)
2. Module files (any order)
3. `main.js` - Application initialization (must load last)

## Global Namespace

All modules export to the `window` object with descriptive names:
- `window.AllmightyUtils` - Core utilities
- `window.AllmightyConversion` - Application controller
- `window.JsonToTable` - JSON to table module
- `window.TableToJson` - Table to JSON module

## Error Handling

- Global error handlers are set up in `main.js`
- Each module should handle its own errors gracefully
- User-facing error messages use the utility functions

## Future Modules

When adding new modules:

1. Create a new file in the `js/` directory
2. Follow the module template structure
3. Register the module in `main.js`
4. Add the script tag to `index.html`
5. Update this README

## Debug Mode

Set `debug: true` in `main.js` to enable detailed logging in the console.