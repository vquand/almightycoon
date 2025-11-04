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
- **Advanced Table Features**:
  - Resizable panels: Drag divider to adjust JSON input and table output areas
  - Column-specific search with regex support above each column
  - Unique value filtering with dropdown for each column
  - Pagination for large datasets with customizable page sizes
  - Column sorting and hierarchical color coding
- **Nested JSON Support**:
  - Flatten nested objects with expand/collapse functionality
  - Visual distinction for nested elements (different colors)
  - Interactive tree-view for complex data structures
- **Modern User Interface**:
  - Toast notifications for user feedback (non-intrusive)
  - Responsive design for desktop and mobile devices
  - No vertical space wasted on message areas
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

- **Modern Development Setup**: Uses Tailwind CSS for styling
- **Offline Capable**: No internet connection required
- **Build System**: Tailwind CSS with PostCSS for optimized styles
- **No Runtime Dependencies**: Uses only vanilla JavaScript and browser APIs
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
- Resizable panels for optimal workspace utilization
- Toast notification system for non-intrusive user feedback
- Column-specific search and filtering capabilities
- Tab-based interface for different conversion tools
- Drag-and-drop file upload support
- Real-time preview of converted data with pagination
- Export buttons with file naming options
- Mobile-responsive design with touch support

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
- **Frontend**: Vanilla JavaScript (ES6+), HTML5 semantic markup
- **Styling**: Tailwind CSS 3.4+ with custom configuration
- **Build Tools**: PostCSS, Autoprefixer for CSS optimization
- **Development**: Live CSS compilation with file watching
- **Package Management**: npm for dependency management

### Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Development Mode** (watch CSS + serve):
   ```bash
   npm run dev
   ```

3. **Production Build**:
   ```bash
   npm run build
   ```

4. **Custom CSS Only**:
   ```bash
   npm run build-css-prod
   ```

### Project Structure

```
almightycoon/
├── src/
│   └── input.css          # Tailwind CSS source file
├── css/
│   └── styles.css          # Compiled CSS (generated)
├── js/
│   ├── utils.js           # Utility functions
│   ├── json-to-table.js   # Main functionality
│   ├── table-to-json.js   # Future features
│   └── main.js            # Application entry point
├── index.html             # Main HTML file
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
└── package.json           # Dependencies and scripts
```