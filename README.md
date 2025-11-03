# Almightycoon

A powerful, client-side data conversion tool that works entirely offline in your browser.

## Project Overview

Almightycoon is a single HTML application that allows users to convert and transform data between multiple formats without requiring any internet connection or cloud services. The application runs entirely in the browser using vanilla JavaScript.

## Features

### JSON to Table Converter
- **Multiple Input Methods**:
  - Paste JSON directly into a text area
  - Load JSON from local files via file picker
- **Smart Table Display**:
  - Automatically detects JSON arrays vs objects
  - Arrays are converted to multi-row tables
  - Objects are converted to single-row tables
- **Nested JSON Support**:
  - Flatten nested objects with expand/collapse functionality
  - Visual distinction for nested elements (different colors)
  - Interactive tree-view for complex data structures
- **Export Capabilities**:
  - Export tables to CSV format
  - Automatic download to browser's default download location

### Future Features (Planned)
- CSV to JSON converter
- XML to JSON converter
- YAML to JSON converter
- JSON to XML converter
- Data validation and formatting tools
- Bulk file processing

## Technical Requirements

- **Single HTML File**: The entire application is contained in one HTML file
- **Offline Capable**: No internet connection required
- **No External Dependencies**: Uses only vanilla JavaScript and browser APIs
- **Modern Browser Support**: Compatible with Chrome, Firefox, Safari, Edge
- **Responsive Design**: Works on desktop and mobile devices
- **File Handling**: Read and write files locally using browser File API

## Implementation Details

### JSON Processing Logic
- Recursive parsing of nested JSON structures
- Dynamic table generation based on JSON structure
- Expand/collapse state management for nested elements
- Error handling for malformed JSON

### User Interface
- Tab-based interface for different conversion tools
- Drag-and-drop file upload support
- Real-time preview of converted data
- Export buttons with file naming options

### File Export
- Uses browser's download API for local file saving
- Automatic CSV formatting from table data
- Proper handling of special characters and escaping

## Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Usage
1. Open the HTML file in any modern web browser
2. Navigate to the desired conversion tab
3. Input your data (paste or upload file)
4. Review the converted output
5. Export the result to your preferred format

## Development
This project is built with:
- Vanilla JavaScript (ES6+)
- HTML5 semantic markup
- CSS3 with flexbox/grid
- No build tools or frameworks required