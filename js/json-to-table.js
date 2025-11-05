/**
 * JSON to Table Converter Module
 * Handles JSON input, parsing, flattening, and table generation
 */

// Global state for this module
let currentData = null;
let currentRows = [];
let originalRows = []; // Store original unsorted rows
let currentColumns = [];
let sortColumn = null;
let sortDirection = null; // 'asc', 'desc', or null (no sort)
let lastSortColumn = null; // Track last clicked column for cycle continuation
let expandedCells = new Set();

// Pagination state
let currentPage = 1;
let pageSize = 25;
let totalPages = 1;
let paginatedRows = [];

// Column search state
let availableColumns = [];
let filteredColumns = [];
let selectedColumnIndex = -1;

// Column filter state
let columnFilters = new Map(); // columnName -> { search: string, values: Set() }
let allUniqueValues = new Map(); // columnName -> array of unique values
let globalSearchFilter = ''; // Global search term that filters all columns
let filteredData = []; // Data after applying all filters

// Performance optimization state
let isProcessing = false;
let renderQueue = [];
let isRenderScheduled = false;

// Debounced search state
let searchTimeouts = new Map(); // columnIndex -> timeoutId

// Dropdown state preservation
let openDropdownColumn = null; // Store which column dropdown is open

// Focus preservation for search inputs
let focusedColumnInput = null; // Track which input is currently focused

// Prevent unnecessary re-renders
let renderTimeoutId = null;
let isSearchDirty = false;

// Session storage keys for decoupled communication
const STORAGE_KEYS = {
    COLUMN_SEARCH: 'almightycoon_column_search',
    COLUMN_FILTERS: 'almightycoon_column_filters',
    UNIQUE_VALUES: 'almightycoon_unique_values',
    GLOBAL_SEARCH: 'almightycoon_global_search'
};

// Virtual scrolling state
let virtualScrollingEnabled = false;
let virtualScrollContainer = null;
let virtualRowHeight = 35; // pixels
let virtualVisibleRows = 0;
let virtualScrollPosition = 0;

// Compute and cache unique values for all columns
function computeAndCacheUniqueValues(rows, columns) {
    if (!rows || rows.length === 0 || !columns || columns.length === 0) {
        console.log('[CACHE] No data or columns, skipping unique values computation');
        return;
    }

    console.log(`[CACHE] Computing unique values for ${columns.length} columns from ${rows.length} rows`);

    const uniqueValuesMap = {};

    // Compute unique values for each column
    columns.forEach(columnName => {
        const values = new Set();

        rows.forEach(row => {
            const value = row[columnName];
            const stringValue = value !== null && value !== undefined ? String(value) : '';
            values.add(stringValue);
        });

        uniqueValuesMap[columnName] = Array.from(values).sort();
        console.log(`[CACHE] Column "${columnName}": ${uniqueValuesMap[columnName].length} unique values`);
    });

    // Save to session storage
    try {
        sessionStorage.setItem(STORAGE_KEYS.UNIQUE_VALUES, JSON.stringify(uniqueValuesMap));
        console.log(`[CACHE] Successfully cached unique values for ${Object.keys(uniqueValuesMap).length} columns`);

        // Also store in memory for faster access
        allUniqueValues.clear();
        Object.entries(uniqueValuesMap).forEach(([columnName, values]) => {
            allUniqueValues.set(columnName, values);
        });

    } catch (e) {
        console.error('[CACHE] Failed to cache unique values:', e);
        // Fallback to in-memory storage only
        allUniqueValues.clear();
        Object.entries(uniqueValuesMap).forEach(([columnName, values]) => {
            allUniqueValues.set(columnName, values);
        });
    }
}

// Restore all filter button colors and placeholders after table re-render
function restoreAllFilterButtonStates() {
    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');

    currentColumns.forEach((columnName, index) => {
        const columnIndex = index + 1; // +1 because column 0 is the row number
        updateFilterHeaderControls(columnIndex, columnName);
    });

    console.log('Restored all filter button states after table re-render');
}

// Update filter button color and input placeholder together
function updateFilterHeaderControls(columnIndex, columnName) {
    const button = document.getElementById(`col-filter-btn-${columnIndex}`);
    const searchInput = document.getElementById(`col-search-${columnIndex}`);

    // Return early if elements don't exist yet
    if (!button) {
        console.warn(`Filter button not found: col-filter-btn-${columnIndex}`);
        return;
    }

    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
    const filter = columnFilters[columnName] || { values: [] };
    const filterCount = filter.values ? filter.values.length : 0;

    // Update button color
    if (filterCount > 0) {
        button.className = 'btn btn-danger btn-sm';
    } else {
        button.className = 'btn btn-outline-primary btn-sm';
    }

    // Update placeholder and make input read-only when filters are active
    if (searchInput) {
        searchInput.placeholder = generateFilterPlaceholder(columnName);
        searchInput.readOnly = filterCount > 0;
        searchInput.title = filterCount > 0 ?
            'Clear filters to search again' :
            'Search with regex or click filter button for options';
    }
}

// Generate placeholder text showing selected filter options
function generateFilterPlaceholder(columnName) {
    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
    const filter = columnFilters[columnName] || { values: [] };
    const selectedValues = filter.values || [];

    if (selectedValues.length === 0) {
        return 'Search...';
    } else if (selectedValues.length === 1) {
        return `Filtered: ${selectedValues[0]}`;
    } else if (selectedValues.length <= 3) {
        return `Filtered: ${selectedValues.join(', ')}`;
    } else {
        return `Filtered: ${selectedValues.slice(0, 2).join(', ')} +${selectedValues.length - 2} more`;
    }
}

// Check if a column contains primarily numeric data
function isNumericColumn(columnName) {
    if (!currentRows || currentRows.length === 0) return false;

    // Sample first 10 rows to determine if column is numeric
    const sampleSize = Math.min(10, currentRows.length);
    let numericCount = 0;

    for (let i = 0; i < sampleSize; i++) {
        const value = currentRows[i][columnName];
        if (value !== null && value !== undefined && value !== '') {
            const stringValue = String(value).trim();
            // Check if it's a valid number (int, float, or currency)
            if (/^-?\d+\.?\d*$/.test(stringValue) ||
                /^\$?-?\d+\.?\d*$/.test(stringValue) ||
                /^-?\d+\.?\d*%?$/.test(stringValue)) {
                numericCount++;
            }
        }
    }

    // If more than 70% of non-null values are numeric, consider it a numeric column
    return numericCount / sampleSize > 0.7;
}

// Get unique values from cache (session storage or memory)
function getUniqueValuesFromCache(columnName) {
    // Try memory first (fastest)
    if (allUniqueValues.has(columnName)) {
        return allUniqueValues.get(columnName);
    }

    // Try session storage
    try {
        const cachedValues = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.UNIQUE_VALUES) || '{}');
        if (cachedValues[columnName]) {
            // Load into memory for future use
            allUniqueValues.set(columnName, cachedValues[columnName]);
            return cachedValues[columnName];
        }
    } catch (e) {
        console.warn('[CACHE] Failed to retrieve cached values from storage:', e);
    }

    console.warn(`[CACHE] No cached values found for column "${columnName}"`);
    return [];
}

// Initialize the JSON to Table module
function initJsonToTable() {
    // Clear session storage on page load to ensure fresh state
    try {
        sessionStorage.removeItem(STORAGE_KEYS.COLUMN_FILTERS);
        sessionStorage.removeItem(STORAGE_KEYS.COLUMN_SEARCH);
        sessionStorage.removeItem(STORAGE_KEYS.UNIQUE_VALUES);
        console.log('[INIT] Session storage cleared');
    } catch (e) {
        console.warn('[INIT] Failed to clear session storage:', e);
    }

    // Initialize session storage listener first
    initializeSearchListener();

    // Set up file input handler
    const fileInput = document.getElementById('jsonFile');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Set up converter type selector
    const converterSelect = document.getElementById('converterType');
    if (converterSelect) {
        converterSelect.addEventListener('change', handleConverterChange);
    }

    // Set up column search
    setupColumnSearch();

    // Set up export button
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportToCsv);
    }
}

// Handle file upload
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const jsonInput = document.getElementById('jsonInput');
            if (jsonInput) {
                jsonInput.value = e.target.result;
            }

            const fileInfo = document.getElementById('fileInfo');
            if (fileInfo) {
                fileInfo.innerHTML = `✅ Loaded: ${file.name} (${window.AllmightyUtils.formatFileSize(file.size)})`;
            }
        };
        reader.readAsText(file);
    }
}

// Handle converter type change
function handleConverterChange(e) {
    const converterType = e.target.value;

    // Clear current data and reset UI
    resetUI();

    // Show message for non-JSON converters
    if (converterType !== 'json-to-table') {
        window.AllmightyUtils.showInfo(`${getConverterName(converterType)} is coming soon!`);
    }
}

// Get converter display name
function getConverterName(type) {
    const names = {
        'json-to-table': 'JSON to Table',
        'table-to-json': 'Table to JSON',
        'csv-converter': 'CSV Converter',
        'xml-converter': 'XML Converter'
    };
    return names[type] || type;
}


// Setup column search functionality
function setupColumnSearch() {
    const searchInput = document.getElementById('columnSearch');
    const suggestions = document.getElementById('columnSuggestions');

    if (!searchInput || !suggestions) {
        console.warn('Column search elements not found');
        return;
    }

    
    // Input event for search
    searchInput.addEventListener('input', searchAndGoToColumn);

    // Keyboard navigation with enhanced behavior
    searchInput.addEventListener('keydown', (e) => {
        const items = suggestions.querySelectorAll('.suggestion-item');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (selectedColumnIndex < items.length - 1) {
                    selectedColumnIndex++;
                    updateSuggestionSelection();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (selectedColumnIndex > 0) {
                    selectedColumnIndex--;
                    updateSuggestionSelection();
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedColumnIndex >= 0 && window.filteredColumns && window.filteredColumns[selectedColumnIndex]) {
                    goToColumn(window.filteredColumns[selectedColumnIndex]);
                }
                break;
            case 'Escape':
                hideColumnDropdown();
                searchInput.blur();
                break;
            case 'Tab':
                // Allow tab navigation but close dropdown
                setTimeout(() => hideColumnDropdown(), 100);
                break;
        }
    });

    // Show dropdown on focus
    searchInput.addEventListener('focus', () => {
        searchAndGoToColumn({ target: searchInput });
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#columnSearch') && !e.target.closest('#columnSuggestions')) {
            hideColumnDropdown();
        }
    });

    // Hide dropdown when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideColumnDropdown();
        }
    });
}



// Refresh column search after data conversion
function refreshColumnSearch() {
    // Clear any existing dropdown state
    hideColumnDropdown();

    // Clear search input
    const searchInput = document.getElementById('columnSearch');
    if (searchInput) {
        searchInput.value = '';
        // Reset placeholder to show updated status
        searchInput.placeholder = `🎯 Go to column... (${availableColumns.length} available)`;
    }
}

// Show message when no columns are available
function showNoColumnsMessage(searchInput) {
    const suggestions = document.getElementById('columnSuggestions');
    if (!suggestions) return;

    suggestions.innerHTML = `
        <div class="suggestion-item disabled" style="color: #9ca3af; font-style: italic; cursor: default;">
            <div class="flex items-center gap-2">
                <span>📊 No columns available</span>
            </div>
            <div class="text-xs text-gray-400 mt-1">
                Load JSON data first to see columns
            </div>
        </div>
    `;

    suggestions.classList.add('show');
    searchInput.setAttribute('aria-expanded', 'true');

    // Auto-hide after 3 seconds
    setTimeout(() => {
        hideColumnDropdown();
    }, 3000);
}

// Hide column dropdown
function hideColumnDropdown() {
    const suggestions = document.getElementById('columnSuggestions');
    if (suggestions) {
        suggestions.classList.remove('show');
        suggestions.classList.add('d-none');
        selectedColumnIndex = -1;

        // Update ARIA attributes
        const searchInput = document.getElementById('columnSearch');
        if (searchInput) {
            searchInput.setAttribute('aria-expanded', 'false');
        }
    }
}

// Update suggestion selection
function updateSuggestionSelection() {
    const items = document.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
        if (index === selectedColumnIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

// Go to column with enhanced navigation
function goToColumn(columnName) {
    console.log('=== goToColumn FUNCTION START ===');
    console.log('goToColumn called with:', columnName);

    hideColumnDropdown();

    const searchInput = document.getElementById('columnSearch');
    if (searchInput) {
        searchInput.value = columnName;
    }

    // Find the column index in the header table
    const headerTable = document.querySelector('.sticky-header-container .table');
    if (!headerTable) {
        console.warn('No header table found for column navigation');
        window.AllmightyUtils.showError('Header table not found');
        return;
    }

    const headers = headerTable.querySelectorAll('th');
    let columnIndex = -1;

    console.log('Available headers:');
    headers.forEach((header, index) => {
        // Look for the column name in the header chip
        const headerChip = header.querySelector('.header-chip');
        let headerText = headerChip ? headerChip.textContent.trim() : header.textContent.trim();

        // Remove sort indicators (↑, ↓) and extra whitespace for matching
        headerText = headerText.replace(/[↑↓]/g, '').trim();

        console.log(`Header ${index}: "${headerText}" (original: "${headerChip ? headerChip.textContent.trim() : header.textContent.trim()}")`);

        if (headerText === columnName) {
            columnIndex = index;
            console.log(`Found match at index ${index}`);
        }
    });

    if (columnIndex === -1) {
        console.warn(`Column "${columnName}" not found in table`);
        window.AllmightyUtils.showError(`Column "${columnName}" not found`);
        return;
    }

    // Scroll to the column in both containers with smooth animation
    const bodyContainer = document.querySelector('.table-body-container');
    const headerContainer = document.querySelector('.sticky-header-container');

    console.log('Containers found - bodyContainer:', !!bodyContainer, 'headerContainer:', !!headerContainer);

    if (bodyContainer && headerContainer) {
        const header = headers[columnIndex];
        if (header) {
            const headerLeft = header.offsetLeft;
            const containerWidth = bodyContainer.clientWidth;
            const headerWidth = header.offsetWidth;
            const scrollTarget = headerLeft - (containerWidth / 2) + (headerWidth / 2);

            console.log(`Scroll calculation details:`);
            console.log(`  header.offsetLeft: ${headerLeft}`);
            console.log(`  container.clientWidth: ${containerWidth}`);
            console.log(`  header.offsetWidth: ${headerWidth}`);
            console.log(`  calculated scrollTarget: ${scrollTarget}`);
            console.log(`  final scroll position: ${Math.max(0, scrollTarget)}`);

            // Check if containers can scroll
            console.log(`Body container - scrollWidth: ${bodyContainer.scrollWidth}, clientWidth: ${bodyContainer.clientWidth}, canScroll: ${bodyContainer.scrollWidth > bodyContainer.clientWidth}`);
            console.log(`Header container - scrollWidth: ${headerContainer.scrollWidth}, clientWidth: ${headerContainer.clientWidth}, canScroll: ${headerContainer.scrollWidth > headerContainer.clientWidth}`);

            // Scroll both containers to ensure they stay in sync
            const scrollOptions = {
                left: Math.max(0, scrollTarget),
                behavior: 'smooth'
            };

            console.log('About to scroll with options:', scrollOptions);
            bodyContainer.scrollTo(scrollOptions);
            headerContainer.scrollTo(scrollOptions);

            // Check scroll position after scrolling
            setTimeout(() => {
                console.log(`After scroll - Body scrollLeft: ${bodyContainer.scrollLeft}, Header scrollLeft: ${headerContainer.scrollLeft}`);
            }, 100);
        }
    } else {
        console.warn('Containers not found - bodyContainer:', !!bodyContainer, 'headerContainer:', !!headerContainer);
    }

    // Highlight the column temporarily with enhanced visual feedback
    highlightColumn(columnIndex);

    // Show success message with column info
    const columnNumber = columnIndex; // 0-based index
    window.AllmightyUtils.showSuccess(`🎯 Jumped to column "${columnName}" (${columnNumber + 1})`);

    // Auto-clear the success message after 3 seconds
    setTimeout(() => {
        window.AllmightyUtils.clearAllToasts();
    }, 3000);

    // Add a simple test to check if scrolling works
    console.log('Testing scroll capability...');
    if (bodyContainer) {
        console.log('Body container scrollLeft:', bodyContainer.scrollLeft, 'scrollWidth:', bodyContainer.scrollWidth, 'clientWidth:', bodyContainer.clientWidth);
        console.log('Body can scroll:', bodyContainer.scrollWidth > bodyContainer.clientWidth);
    }
    if (headerContainer) {
        console.log('Header container scrollLeft:', headerContainer.scrollLeft, 'scrollWidth:', headerContainer.scrollWidth, 'clientWidth:', headerContainer.clientWidth);
        console.log('Header can scroll:', headerContainer.scrollWidth > headerContainer.clientWidth);
    }

    // Add a subtle pulse animation to the column header
    const header = headers[columnIndex];
    if (header) {
        header.style.animation = 'pulse 0.6s ease-in-out 2';
        setTimeout(() => {
            if (header) {
                header.style.animation = '';
            }
        }, 1200);
    }
}

// Backward compatibility
function selectColumn(columnName) {
    goToColumn(columnName);
}

// Apply column filter (called from filter dropdown buttons)
function applyColumnFilter(columnIndex, columnName) {
    console.log('Applying filter for column:', columnName);

    // This function would typically handle the filter application logic
    // For now, we'll just update the button visibility
    updateClearAllFiltersButton();
}

// Clear all column filters
function clearAllFilters() {
    console.log('Clearing all column filters...');

    // Clear all filter data
    columnFilters.clear();
    allUniqueValues.clear();
    globalSearchFilter = ''; // Clear global search
    filteredData = [...currentRows];

    // Clear session storage
    try {
        sessionStorage.removeItem(STORAGE_KEYS.COLUMN_FILTERS);
        sessionStorage.removeItem(STORAGE_KEYS.COLUMN_SEARCH);
        sessionStorage.removeItem(STORAGE_KEYS.GLOBAL_SEARCH);
        console.log('Cleared filter state from session storage');
    } catch (e) {
        console.error('Failed to clear filter state from session storage:', e);
    }

    // Clear global search input
    const searchInput = document.getElementById('columnSearch');
    if (searchInput) {
        searchInput.value = '';
        updateGlobalSearchVisualFeedback();
    }

    // Reset filter button states
    currentColumns.forEach((col, index) => {
        const columnIndex = index + 1; // +1 because column 0 is the row number
        const button = document.getElementById(`col-filter-btn-${columnIndex}`);
        const searchInput = document.getElementById(`col-search-${columnIndex}`);

        if (button) {
            button.className = 'btn btn-outline-primary btn-sm';
            const icon = button.querySelector('i');
            if (icon) {
                icon.className = 'bi bi-funnel';
            }
        }

        if (searchInput) {
            searchInput.value = '';
            searchInput.placeholder = `Search ${col}...`;
            searchInput.readOnly = false;
        }
    });

    // Update pagination to show all data
    currentPage = 1;
    updatePaginationAsync();

    // Re-render the table
    scheduleTableRender();

    // Show success message
    window.AllmightyUtils.showSuccess('✅ All filters cleared successfully');

    console.log('All filters cleared successfully');

    // Hide the clear all filters button
    updateClearAllFiltersButton();
}

// Update the visibility of the "Clear All Filters" button
function updateClearAllFiltersButton() {
    const container = document.getElementById('clearAllFiltersBtnContainer');
    if (!container) return;

    // Show button if there are any active filters
    const columnSearchState = sessionStorage.getItem(STORAGE_KEYS.COLUMN_SEARCH);
    const hasColumnSearch = columnSearchState && Object.keys(JSON.parse(columnSearchState)).length > 0;

    const hasActiveFilters = columnFilters.size > 0 ||
                           globalSearchFilter !== '' ||
                           hasColumnSearch ||
                           sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) !== null ||
                           sessionStorage.getItem(STORAGE_KEYS.GLOBAL_SEARCH) !== null;

    if (hasActiveFilters) {
        container.classList.remove('d-none');
    } else {
        container.classList.add('d-none');
    }
}

// Get column nesting level
function getColumnLevel(columnName) {
    return (columnName.match(/\./g) || []).length;
}

// Ensure sticky headers work properly after table rendering
function ensureStickyHeaders() {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;

    const headerContainer = tableContainer.querySelector('.sticky-header-container');
    const bodyContainer = tableContainer.querySelector('.table-body-container');

    if (!headerContainer || !bodyContainer) return;

    // Synchronize horizontal scrolling between header and body
    bodyContainer.addEventListener('scroll', () => {
        headerContainer.scrollLeft = bodyContainer.scrollLeft;
    });

    // Set initial body container height
    const availableHeight = window.innerHeight - 350; // Adjust as needed
    bodyContainer.style.maxHeight = `${availableHeight}px`;

    // Synchronize column widths
    synchronizeColumnWidths();

    // Re-synchronize after a short delay to ensure DOM is fully rendered
    setTimeout(() => {
        synchronizeColumnWidths();
        restoreAllFilterButtonStates();
    }, 100);

    // Re-synchronize on window resize
    window.addEventListener('resize', () => {
        setTimeout(() => {
            synchronizeColumnWidths();
        }, 50);
    });

    // Log for debugging
    console.log('Sticky headers with separate containers setup completed');
}

// Synchronize column widths between header and body tables
function synchronizeColumnWidths() {
    const headerTable = document.querySelector('.sticky-header-container .table');
    const bodyTable = document.querySelector('.table-body-container .table');

    if (!headerTable || !bodyTable) return;

    // Get all header cells and body cells in the first row
    const headerCells = headerTable.querySelectorAll('th');
    const bodyCells = bodyTable.querySelectorAll('tbody tr:first-child td');

    if (headerCells.length === 0 || bodyCells.length === 0) return;

    // Create a temporary container to measure natural widths
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.visibility = 'hidden';
    tempContainer.style.height = 'auto';
    tempContainer.style.width = 'auto';
    tempContainer.style.whiteSpace = 'nowrap';
    tempContainer.style.fontFamily = window.getComputedStyle(headerTable).fontFamily;
    tempContainer.style.fontSize = window.getComputedStyle(headerTable).fontSize;
    document.body.appendChild(tempContainer);

    try {
        headerCells.forEach((headerCell, index) => {
            if (bodyCells[index]) {
                // Measure the natural width of the content in both cells
                tempContainer.textContent = headerCell.textContent;
                const headerContentWidth = tempContainer.offsetWidth;

                tempContainer.textContent = bodyCells[index].textContent;
                const bodyContentWidth = tempContainer.offsetWidth;

                // Use the maximum width with some padding
                const maxWidth = Math.max(headerContentWidth, bodyContentWidth, 120);
                const finalWidth = Math.min(maxWidth, 300); // Cap at 300px

                // Apply the same width to both cells
                headerCell.style.width = `${finalWidth}px`;
                headerCell.style.maxWidth = `${finalWidth}px`;
                headerCell.style.minWidth = `${finalWidth}px`;

                bodyCells[index].style.width = `${finalWidth}px`;
                bodyCells[index].style.maxWidth = `${finalWidth}px`;
                bodyCells[index].style.minWidth = `${finalWidth}px`;
            }
        });
    } finally {
        // Clean up the temporary container
        document.body.removeChild(tempContainer);
    }

    // Force table layout to be fixed
    headerTable.style.tableLayout = 'fixed';
    bodyTable.style.tableLayout = 'fixed';

    // Ensure both tables have the same total width
    const headerWidth = headerTable.offsetWidth;
    const bodyWidth = bodyTable.offsetWidth;

    if (headerWidth !== bodyWidth) {
        const maxWidth = Math.max(headerWidth, bodyWidth);
        headerTable.style.width = `${maxWidth}px`;
        bodyTable.style.width = `${maxWidth}px`;
    }

    console.log('Column widths synchronized');
}

// Highlight a column temporarily
function highlightColumn(columnIndex) {
    const headerTable = document.querySelector('.sticky-header-container .table');
    const bodyTable = document.querySelector('.table-body-container .table');

    if (!headerTable || !bodyTable) return;

    // Highlight header cell
    const headerCells = headerTable.querySelectorAll('th');
    if (headerCells[columnIndex]) {
        headerCells[columnIndex].style.backgroundColor = '#fff3cd';
        headerCells[columnIndex].style.transition = 'background-color 1s ease';

        setTimeout(() => {
            if (headerCells[columnIndex]) {
                headerCells[columnIndex].style.backgroundColor = '';
            }
        }, 1500);
    }

    // Highlight body cells in first few rows for performance
    const bodyRows = bodyTable.querySelectorAll('tbody tr');
    const maxRowsToHighlight = Math.min(bodyRows.length, 10); // Limit to first 10 rows for performance

    bodyRows.forEach((row, rowIndex) => {
        if (rowIndex >= maxRowsToHighlight) return;

        const cells = row.querySelectorAll('td');
        if (cells[columnIndex]) {
            cells[columnIndex].style.backgroundColor = '#fff3cd';
            cells[columnIndex].style.transition = 'background-color 1s ease';

            setTimeout(() => {
                if (cells[columnIndex]) {
                    cells[columnIndex].style.backgroundColor = '';
                }
            }, 1500);
        }
    });
}

// Update pagination asynchronously
async function updatePaginationAsync() {
    // Use filtered data if available, otherwise use all data
    const dataToUse = filteredData.length > 0 ? filteredData : currentRows;

    if (!dataToUse.length) {
        hidePagination();
        return;
    }

    totalPages = Math.ceil(dataToUse.length / pageSize);
    currentPage = Math.min(currentPage, totalPages);

    // Calculate pagination bounds
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, dataToUse.length);

    // Get paginated rows asynchronously
    paginatedRows = await new Promise(resolve => {
        setTimeout(() => {
            resolve(dataToUse.slice(startIndex, endIndex));
        }, 0);
    });

    // Update pagination UI
    updatePaginationUI(startIndex + 1, endIndex, dataToUse.length);

    // Enable/disable pagination buttons
    updatePaginationButtons();
}

// Update pagination (synchronous version for compatibility)
function updatePagination() {
    // Use filtered data if available, otherwise use all data
    const dataToUse = filteredData.length > 0 ? filteredData : currentRows;

    console.log('🔍 Pagination update:', {
        filteredDataLength: filteredData.length,
        currentRowsLength: currentRows.length,
        dataToUseLength: dataToUse.length,
        currentPage: currentPage,
        pageSize: pageSize
    });

    if (!dataToUse.length) {
        console.log('🔍 No data to paginate, hiding pagination');
        hidePagination();
        paginatedRows = []; // Explicitly clear paginatedRows
        return;
    }

    totalPages = Math.ceil(dataToUse.length / pageSize);
    currentPage = Math.min(currentPage, totalPages);

    // Calculate pagination bounds
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, dataToUse.length);

    // Get paginated rows
    paginatedRows = dataToUse.slice(startIndex, endIndex);

    console.log('🔍 Updated paginatedRows:', {
        startIndex: startIndex,
        endIndex: endIndex,
        paginatedRowsLength: paginatedRows.length,
        paginatedRows: paginatedRows
    });

    // Update pagination UI
    updatePaginationUI(startIndex + 1, endIndex, dataToUse.length);

    // Enable/disable pagination buttons
    updatePaginationButtons();
}

// Update pagination UI elements
function updatePaginationUI(start, end, total) {
    const startRow = document.getElementById('startRow');
    const endRow = document.getElementById('endRow');
    const totalRows = document.getElementById('totalRows');
    const pageInfo = document.getElementById('pageInfo');

    if (startRow) startRow.textContent = start;
    if (endRow) endRow.textContent = end;
    if (totalRows) totalRows.textContent = total;
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
        paginationContainer.style.display = 'flex';
    }
}

// Update pagination buttons state
function updatePaginationButtons() {
    const firstPage = document.getElementById('firstPage');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    const lastPage = document.getElementById('lastPage');

    if (firstPage) firstPage.disabled = currentPage === 1;
    if (prevPage) prevPage.disabled = currentPage === 1;
    if (nextPage) nextPage.disabled = currentPage === totalPages;
    if (lastPage) lastPage.disabled = currentPage === totalPages;
}

// Hide pagination
function hidePagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
    }
}

// Navigate to a specific page
function goToPage(page) {
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    updatePagination();
    renderPaginatedTable();
}

// Change page size
function changePageSize() {
    const pageSizeSelect = document.getElementById('pageSize');
    if (!pageSizeSelect) return;

    const newSize = parseInt(pageSizeSelect.value);
    if (newSize === pageSize) return;

    pageSize = newSize;
    currentPage = 1; // Reset to first page
    updatePagination();
    renderPaginatedTable();
}

// Reset UI state
function resetUI() {
    currentData = null;
    currentRows = [];
    currentColumns = [];
    sortColumn = null;
    sortDirection = null;
    lastSortColumn = null;
    currentPage = 1;
    availableColumns = [];
    filteredColumns = [];
    selectedColumnIndex = -1;

    // Clear table
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) {
        tableContainer.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="9" x2="15" y2="9"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <h3>No Data Yet</h3>
                <p>Paste JSON data or load a file to get started</p>
            </div>
        `;
    }

    // Hide controls
    hidePagination();
    window.AllmightyUtils.toggleExportControls(false);

    // Clear messages
    window.AllmightyUtils.clearMessages('messageArea');

    // Clear search
    const searchInput = document.getElementById('columnSearch');
    if (searchInput) searchInput.value = '';

    // Clear file info
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) fileInfo.innerHTML = '';

    // Reset file input
    const fileInput = document.getElementById('jsonFile');
    if (fileInput) fileInput.value = '';
}

// Generate table header HTML separately
function generateTableHeaderHTML(columns) {
    let html = '<thead><tr><th style="min-width: 60px; max-width: 60px;">#</th>';
    columns.forEach((col, index) => {
        const hierarchyClass = getColumnHierarchyClass(col);
        const isArrayIndex = col.match(/\[\d+\]$/);
        const arrayClass = isArrayIndex ? ' array-index' : '';
        const sortIndicator = sortColumn === col ? (sortDirection === 'asc' ? ' ↑' : (sortDirection === 'desc' ? ' ↓' : '')) : '';
        const columnIndex = index + 1; // +1 because column 0 is the row number

        const uniqueValues = getUniqueValuesFromCache(col) || [];
        const filterCount = (columnFilters.get(col)?.values?.size || 0);
        const hasActiveFilter = filterCount > 0;

        html += `
        <th class="${hierarchyClass}${arrayClass}" style="min-width: 200px; max-width: 300px;">
            <div class="column-controls">
                <div class="header-chip" onclick="toggleColumnSort('${col.replace(/'/g, "\\'")}')">${col}${sortIndicator}</div>
                <div class="d-flex align-items-center gap-1 mt-1">
                    <button id="col-filter-btn-${columnIndex}"
                            class="btn ${hasActiveFilter ? 'btn-danger' : 'btn-outline-primary'} btn-sm"
                            onclick="toggleColumnFilter(${columnIndex}, '${col.replace(/'/g, "\\'")}', event)">
                        <i class="bi bi-funnel${hasActiveFilter ? '-fill' : ''}"></i>
                    </button>
                    <input type="text"
                           id="col-search-${columnIndex}"
                           class="form-control form-control-sm"
                           placeholder="Search ${col}..."
                           style="width: 120px;">
                </div>
                <div class="column-filter-dropdown" id="col-filter-dropdown-${columnIndex}">
                    <div class="d-flex gap-2 p-2 border-bottom">
                        <button class="btn btn-outline-secondary btn-sm" onclick="clearColumnFilter(${columnIndex}, '${col.replace(/'/g, "\\'")}')">Clear</button>
                        <button class="btn btn-primary btn-sm" onclick="applyColumnFilter(${columnIndex}, '${col.replace(/'/g, "\\'")}')">Apply</button>
                    </div>
                    <div id="col-filter-options-${columnIndex}">
                        ${generateFilterOptions(col, uniqueValues)}
                    </div>
                </div>
            </div>
        </th>`;
    });
    html += '</tr></thead>';
    return html;
}

// Generate table body HTML separately
function generateTableBodyHTML(rows, columns) {
    const startRowNum = (currentPage - 1) * pageSize + 1;

    let html = '<tbody>';
    rows.forEach((row, index) => {
        const rowNum = startRowNum + index;
        html += `<tr><td><strong>${rowNum}</strong></td>`;

        columns.forEach(col => {
            const cellValue = row[col] || '';
            const displayValue = window.AllmightyUtils.escapeHtml(window.AllmightyUtils.formatValue(cellValue));
            const isNumeric = isNumericColumn(col);
            const alignment = isNumeric ? 'text-end' : 'text-start';
            const hierarchyClass = getColumnHierarchyClass(col);
            const isArrayIndex = col.match(/\[\d+\]$/);
            const arrayClass = isArrayIndex ? ' array-index' : '';

            html += `<td class="${hierarchyClass}${arrayClass} ${alignment}">
                <div class="cell-content">${displayValue}</div>
            </td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';
    return html;
}

// Generate paginated table HTML (fallback)
function generatePaginatedTableHTML(rows, columns) {
    // Get actual row numbers (considering pagination)
    const startRowNum = (currentPage - 1) * pageSize + 1;

    let html = '<table class="table table-striped table-hover table-bordered"><thead><tr><th style="min-width: 60px; max-width: 60px;">#</th>';
    columns.forEach((col, index) => {
        const hierarchyClass = getColumnHierarchyClass(col);
        const isArrayIndex = col.match(/\[\d+\]$/);
        const arrayClass = isArrayIndex ? ' array-index' : '';
        const sortIndicator = sortColumn === col ? (sortDirection === 'asc' ? ' ↑' : (sortDirection === 'desc' ? ' ↓' : '')) : '';
        const columnIndex = index + 1; // +1 because column 0 is the row number

        const uniqueValues = getUniqueValuesFromCache(col) || [];
        const filterCount = (columnFilters.get(col)?.values?.size || 0);
        const hasActiveFilter = filterCount > 0;

        html += `
        <th class="${hierarchyClass}${arrayClass}" style="min-width: 200px; max-width: 300px;">
            <div class="column-controls">
                <div class="d-flex gap-1 align-items-center mb-1">
                    <input type="text"
                           class="form-control form-control-sm"
                           id="col-search-${columnIndex}"
                           placeholder="${generateFilterPlaceholder(col)}"
                           onkeyup="filterByColumn(${columnIndex}, '${window.AllmightyUtils.escapeHtml(col)}', this.value)"
                           onfocus="setColumnSearchFocus(${columnIndex})"
                           onblur="setColumnSearchBlur(${columnIndex})"
                           onclick="event.stopPropagation()">
                    <button class="btn ${hasActiveFilter ? 'btn-danger' : 'btn-outline-primary'} btn-sm"
                            id="col-filter-btn-${columnIndex}"
                            onclick="showColumnUniqueValues(${columnIndex}, '${window.AllmightyUtils.escapeHtml(col)}', event)">
                        <span id="col-filter-icon-${columnIndex}">${filterCount > 0 ? `${filterCount} x` : 'v'}</span>
                    </button>
                </div>
                <div class="column-filter-dropdown" id="col-filter-dropdown-${columnIndex}">
                    <div class="d-flex gap-2 p-2 border-bottom">
                        <button class="btn btn-outline-secondary btn-sm" onclick="clearColumnFilter(${columnIndex}, '${window.AllmightyUtils.escapeHtml(col)}')">Clear</button>
                        <button class="btn btn-primary btn-sm" onclick="applyColumnFilter(${columnIndex}, '${window.AllmightyUtils.escapeHtml(col)}')">Apply</button>
                    </div>
                    <div id="col-filter-options-${columnIndex}">
                        ${generateFilterOptions(col, uniqueValues)}
                    </div>
                </div>
                <div style="cursor: pointer; margin-top: 4px;"
                     onclick="toggleColumnSort('${window.AllmightyUtils.escapeHtml(col)}')"
                     title="Click to sort by ${window.AllmightyUtils.escapeHtml(col)}">
                    <div class="header-chip">
                        ${window.AllmightyUtils.escapeHtml(col)}
                        <span class="sort-indicator">${sortIndicator}</span>
                    </div>
                </div>
            </div>
        </th>`;
    });
    html += '</tr></thead><tbody>';

    rows.forEach((row, index) => {
        const actualRowNum = startRowNum + index;
        html += `<tr><td><strong>${actualRowNum}</strong></td>`;
        columns.forEach(col => {
            const cellValue = row[col] || '';
            html += `<td>${window.AllmightyUtils.escapeHtml(window.AllmightyUtils.formatValue(cellValue))}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}

// Schedule table rendering for better performance
function scheduleTableRender() {
    if (isRenderScheduled) return;

    // If a search input is focused, delay rendering to prevent focus loss
    if (focusedColumnInput !== null) {
        console.log(`Delaying render because input col-${focusedColumnInput} is focused`);

        // Schedule render for when focus is lost or after a longer delay
        if (renderTimeoutId) {
            clearTimeout(renderTimeoutId);
        }

        renderTimeoutId = setTimeout(() => {
            // Check if still focused after delay
            if (focusedColumnInput === null) {
                console.log('Input no longer focused, proceeding with render');
                performTableRender();
            } else {
                console.log('Input still focused, forcing background update');
                performBackgroundUpdate();
            }
        }, 500); // Longer delay when input is focused

        return;
    }

    performTableRender();
}

// Separate the actual rendering logic
function performTableRender() {
    // Store current UI state to restore after render
    const activeDropdown = openDropdownColumn;
    const searchValues = new Map(); // columnIndex -> searchValue
    const activeElement = document.activeElement;
    const activeElementId = activeElement ? activeElement.id : null;

    // Get search values from session storage (most accurate)
    try {
        const searchState = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_SEARCH) || '{}');

        Object.entries(searchState).forEach(([columnName, searchValue]) => {
            const columnIndex = currentColumns.indexOf(columnName) + 1;
            if (columnIndex > 0) {
                searchValues.set(columnIndex, {
                    value: searchValue || '',
                    cursorStart: searchValue ? searchValue.length : 0,
                    cursorEnd: searchValue ? searchValue.length : 0
                });
            }
        });
    } catch (e) {
        console.error('Failed to restore search values from session storage:', e);

        // Fallback to current input values
        columnFilters.forEach((filter, columnName) => {
            const columnIndex = currentColumns.indexOf(columnName) + 1;
            const input = document.getElementById(`col-search-${columnIndex}`);
            if (input) {
                searchValues.set(columnIndex, {
                    value: input.value,
                    cursorStart: input.selectionStart,
                    cursorEnd: input.selectionEnd
                });
            }
        });
    }

    isRenderScheduled = true;
    requestAnimationFrame(() => {
        renderPaginatedTable();
        isRenderScheduled = false;

        // Restore UI state after render
        setTimeout(() => {
            // Restore search input values and cursor position
            searchValues.forEach((state, columnIndex) => {
                const input = document.getElementById(`col-search-${columnIndex}`);
                if (input) {
                    const restoredValue = state.value || '';
                    const cursorPos = state.cursorEnd || state.value?.length || 0;

                    console.log(`Restoring search input col-${columnIndex} with value: "${restoredValue}"`);
                    input.value = restoredValue;
                    input.setSelectionRange(cursorPos, cursorPos);
                }
            });

            // Restore focus
            if (activeElementId) {
                const elementToFocus = document.getElementById(activeElementId);
                if (elementToFocus) {
                    elementToFocus.focus();
                }
            }

            // Restore dropdown state with proper positioning
            if (activeDropdown !== null) {
                const button = document.getElementById(`col-filter-btn-${activeDropdown}`);
                const dropdown = document.getElementById(`col-filter-dropdown-${activeDropdown}`);
                if (button && dropdown) {
                    // Calculate position for the dropdown
                    const buttonRect = button.getBoundingClientRect();
                    dropdown.style.top = `${buttonRect.bottom + window.scrollY + 2}px`;
                    dropdown.style.left = `${buttonRect.left + window.scrollX}px`;
                    dropdown.style.width = `${Math.max(200, Math.min(300, buttonRect.width))}px`;
                    dropdown.classList.add('show');
                }
            }

            // Restore all filter button colors and placeholders after table re-render
            restoreAllFilterButtonStates();
        }, 50); // Increased delay to ensure DOM is fully ready after sorting
    });
}

// Generate only the table body HTML (no headers)
function generateTableBody() {
    // Check if we have any active filters (column search or global search)
    const hasActiveFilters = columnFilters.size > 0 || globalSearchFilter !== '';
    const dataToUse = hasActiveFilters ? filteredData : currentRows;

    console.log('🔍 generateTableBody:', {
        filteredDataLength: filteredData.length,
        currentRowsLength: currentRows.length,
        hasActiveFilters: hasActiveFilters,
        usingFilteredData: hasActiveFilters,
        dataToUseLength: dataToUse.length
    });

    if (!dataToUse.length) {
        console.log('🔍 No data to show, returning empty tbody');
        return '<tbody></tbody>';
    }

    let html = '<tbody>';
    dataToUse.forEach((row, index) => {
        const rowNum = index + 1;
        html += `<tr><td><strong>${rowNum}</strong></td>`;

        currentColumns.forEach(col => {
            const cellValue = row[col] || '';
            const displayValue = window.AllmightyUtils.escapeHtml(window.AllmightyUtils.formatValue(cellValue));
            const isNumeric = isNumericColumn(col);
            const textClass = isNumeric ? 'text-end' : '';

            // Handle cell expansion for long content
            if (typeof cellValue === 'string' && cellValue.length > 200) {
                const cellId = `cell-${rowNum}-${currentColumns.indexOf(col)}`;
                const isExpanded = expandedCells.has(cellId);
                const shortValue = displayValue.substring(0, 200) + '...';
                const fullValue = displayValue;

                html += `<td class="${textClass}">
                    <div class="cell-content ${isExpanded ? 'expanded' : ''}" id="${cellId}">
                        <span class="cell-text">${isExpanded ? fullValue : shortValue}</span>
                        ${cellValue.length > 200 ? `
                            <button class="expand-btn" onclick="toggleCellExpansion('${cellId}')" title="${isExpanded ? 'Click to collapse' : 'Click to expand'}">
                                ${isExpanded ? '▼' : '▶'}
                            </button>
                        ` : ''}
                    </div>
                </td>`;
            } else {
                html += `<td class="${textClass}">${displayValue}</td>`;
            }
        });

        html += '</tr>';
    });
    html += '</tbody>';

    return html;
}

// Background update that doesn't recreate search inputs
function performBackgroundUpdate() {
    console.log('Performing background data update without recreating search inputs');

    // Update data silently without triggering full re-render
    applyFiltersWithoutRender();

    console.log('🔍 After filter update:', {
        filteredDataLength: filteredData.length,
        currentRowsLength: currentRows.length
    });

    // Update only the table body, preserving headers with search inputs
    requestAnimationFrame(() => {
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            // Look for the body container which contains the tbody
            const bodyContainer = tableContainer.querySelector('.table-body-container');
            if (bodyContainer) {
                const table = bodyContainer.querySelector('table');
                if (table) {
                    const tbody = table.querySelector('tbody');
                    if (tbody) {
                        // Generate new tbody content
                        const newTbodyHtml = generateTableBody();
                        console.log('🔍 Generated tbody HTML length:', newTbodyHtml.length);
                        tbody.innerHTML = newTbodyHtml;
                        console.log('Background table body update completed');
                    } else {
                        console.warn('❌ No tbody found in body table');
                    }
                } else {
                    console.warn('❌ No table found in body container');
                }
            } else {
                // Fallback: look for any table with tbody (for non-sticky header mode)
                const tbody = tableContainer.querySelector('table tbody');
                if (tbody) {
                    const newTbodyHtml = generateTableBody();
                    console.log('🔍 Generated tbody HTML length (fallback):', newTbodyHtml.length);
                    tbody.innerHTML = newTbodyHtml;
                    console.log('Background table body update completed (fallback)');
                } else {
                    console.warn('❌ No tbody found anywhere in table container');
                }
            }
        } else {
            console.warn('❌ No tableContainer found');
        }
    });
}

// Render table with performance optimizations (no pagination)
function renderPaginatedTable() {
    const dataToUse = filteredData.length > 0 ? filteredData : currentRows;
    if (!dataToUse.length || !currentColumns.length) return;

    // For very large datasets, use progressive rendering
    if (dataToUse.length > 500) {
        renderProgressiveTable();
        return;
    }

    // Show loading state for large datasets
    if (dataToUse.length > 1000) {
        showLoadingState();
    }

    try {
        const tableContainer = document.getElementById('tableContainer');
        if (!tableContainer) return;

        // Use DocumentFragment for faster DOM manipulation
        const fragment = document.createDocumentFragment();
        const tableElement = document.createElement('table');
        tableElement.innerHTML = generatePaginatedTableHTML(dataToUse, currentColumns);
        fragment.appendChild(tableElement);

        // Clear and append in one operation with sticky header approach
        tableContainer.innerHTML = '';

        // Create sticky header container
        const headerContainer = document.createElement('div');
        headerContainer.className = 'sticky-header-container';
        const headerTable = document.createElement('table');
        headerTable.className = 'table table-bordered';
        headerTable.innerHTML = generateTableHeaderHTML(currentColumns);
        headerContainer.appendChild(headerTable);

        // Create body container
        const bodyContainer = document.createElement('div');
        bodyContainer.className = 'table-body-container';
        bodyContainer.style.overflow = 'auto';
        bodyContainer.style.maxHeight = 'calc(100vh - 300px)'; // Adjust height as needed
        const bodyTable = document.createElement('table');
        bodyTable.className = 'table table-striped table-hover table-bordered';
        bodyTable.innerHTML = generateTableBodyHTML(paginatedRows, currentColumns);
        bodyContainer.appendChild(bodyTable);

        // Append both containers
        tableContainer.appendChild(headerContainer);
        tableContainer.appendChild(bodyContainer);

        // Bind event listeners to column search inputs
        bindColumnSearchEventListeners();

        // Ensure sticky headers work properly
        ensureStickyHeaders();

        hideLoadingState();

    } catch (error) {
        console.error('Error rendering table:', error);
        window.AllmightyUtils.showError('Error rendering table. Please try again.');
        hideLoadingState();
    }
}

// Progressive table rendering for large datasets
function renderProgressiveTable() {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;

    const chunkSize = 50; // Render 50 rows at a time
    let currentRow = 0;

    // Create table structure
    const tableElement = document.createElement('table');
    tableElement.innerHTML = generateTableHeader(currentColumns);

    const tbody = document.createElement('tbody');
    tableElement.appendChild(tbody);

    // Clear container and show initial structure
    tableContainer.innerHTML = '';
    tableContainer.appendChild(tableElement);

    // Show progress indicator
    showProgressIndicator(0, paginatedRows.length);

    // Function to render next chunk
    function renderNextChunk() {
        const endIndex = Math.min(currentRow + chunkSize, paginatedRows.length);

        // Create fragment for this chunk
        const fragment = document.createDocumentFragment();

        for (let i = currentRow; i < endIndex; i++) {
            const row = paginatedRows[i];
            const tr = document.createElement('tr');

            // Row number
            const rowNumberTd = document.createElement('td');
            rowNumberTd.innerHTML = `<strong>${i + 1}</strong>`;
            tr.appendChild(rowNumberTd);

            // Data cells
            currentColumns.forEach(col => {
                const td = document.createElement('td');
                const cellValue = row[col] || '';
                td.textContent = window.AllmightyUtils.formatValue(cellValue);
                tr.appendChild(td);
            });

            fragment.appendChild(tr);
        }

        tbody.appendChild(fragment);
        currentRow = endIndex;

        // Update progress
        updateProgress(currentRow, paginatedRows.length);

        // Continue rendering if more rows
        if (currentRow < paginatedRows.length) {
            requestAnimationFrame(renderNextChunk);
        } else {
            hideProgressIndicator();
            // Bind event listeners after progressive rendering is complete
            bindColumnSearchEventListeners();
        }
    }

    // Start rendering
    requestAnimationFrame(renderNextChunk);
}

// Show progress indicator for progressive rendering
function showProgressIndicator(current, total) {
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) {
        const existingIndicator = tableContainer.querySelector('.progress-indicator');
        if (!existingIndicator) {
            const indicator = document.createElement('div');
            indicator.className = 'progress-indicator';
            indicator.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(52, 152, 219, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
            `;
            tableContainer.style.position = 'relative';
            tableContainer.appendChild(indicator);
        }
        updateProgress(current, total);
    }
}

// Update progress indicator
function updateProgress(current, total) {
    const tableContainer = document.getElementById('tableContainer');
    const indicator = tableContainer?.querySelector('.progress-indicator');
    if (indicator) {
        const percentage = Math.round((current / total) * 100);
        indicator.textContent = `Rendering: ${current}/${total} (${percentage}%)`;
    }
}

// Hide progress indicator
function hideProgressIndicator() {
    const tableContainer = document.getElementById('tableContainer');
    const indicator = tableContainer?.querySelector('.progress-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Generate table header HTML
function generateTableHeader(columns) {
    let html = '<thead><tr><th>#</th>';
    columns.forEach(col => {
        const hierarchyClass = getColumnHierarchyClass(col);
        const isArrayIndex = col.match(/\[\d+\]$/);
        const arrayClass = isArrayIndex ? ' array-index' : '';
        const sortIndicator = sortColumn === col ? (sortDirection === 'asc' ? ' ↑' : (sortDirection === 'desc' ? ' ↓' : '')) : '';

        html += `<th class="${hierarchyClass}${arrayClass}" onclick="toggleColumnSort('${col}')" title="Click to sort by ${window.AllmightyUtils.escapeHtml(col)}"><div class="header-chip">${window.AllmightyUtils.escapeHtml(col)}<span class="sort-indicator">${sortIndicator}</span></div></th>`;
    });
    html += '</tr></thead>';
    return html;
}

// Show processing state for async operations
function showProcessingState(message = 'Processing...') {
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) {
        tableContainer.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center" style="height: 200px; color: #666;">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div>${message}</div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }
}

// Show loading state for rendering
function showLoadingState() {
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer && !tableContainer.querySelector('.loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            font-size: 14px;
            color: #666;
        `;
        overlay.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span>Loading...</span>
            </div>
        `;

        tableContainer.style.position = 'relative';
        tableContainer.appendChild(overlay);
    }
}

// Hide loading state
function hideLoadingState() {
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) {
        const overlay = tableContainer.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
}

// Hide processing state
function hideProcessingState() {
    // Processing state uses the same container as showProcessingState
    // No additional cleanup needed as showProcessingState overwrites the content
}

// Smart beautify JSON that handles partial JSON and arrays
function beautifyJson() {
    const jsonInput = document.getElementById('jsonInput');
    if (!jsonInput) {
        window.AllmightyUtils.showError('JSON input area not found');
        return;
    }

    let jsonText = jsonInput.value.trim();
    if (!jsonText || jsonText === '') {
        window.AllmightyUtils.showError('Please enter JSON data to beautify');
        return;
    }

    // Check if the text looks like placeholder content
    if (jsonText.includes('Paste your JSON data here') || jsonText.includes('Examples:')) {
        window.AllmightyUtils.showError('Please enter actual JSON data, not placeholder text.');
        return;
    }

    try {
        // Try direct JSON parsing first
        const parsed = JSON.parse(jsonText);
        const beautified = JSON.stringify(parsed, null, 2);
        jsonInput.value = beautified;
        window.AllmightyUtils.showSuccess('JSON beautified successfully!');
        return;
    } catch (error) {
        // If direct parsing fails, try to fix common partial JSON issues
        let fixedJson = tryFixPartialJson(jsonText);

        try {
            const parsed = JSON.parse(fixedJson);
            const beautified = JSON.stringify(parsed, null, 2);
            jsonInput.value = beautified;
            window.AllmightyUtils.showSuccess('JSON beautified successfully (auto-corrected partial JSON)!');
            return;
        } catch (secondError) {
            // Try array extraction
            const arrayMatch = jsonText.match(/(\[[\s\S]*\])/);
            if (arrayMatch) {
                try {
                    const parsed = JSON.parse(arrayMatch[1]);
                    const beautified = JSON.stringify(parsed, null, 2);
                    jsonInput.value = beautified;
                    window.AllmightyUtils.showSuccess('Array extracted and beautified!');
                    return;
                } catch (arrayError) {
                    // Continue to object extraction
                }
            }

            // Try object extraction
            const objectMatch = jsonText.match(/(\{[\s\S]*\})/);
            if (objectMatch) {
                try {
                    const parsed = JSON.parse(objectMatch[1]);
                    const beautified = JSON.stringify(parsed, null, 2);
                    jsonInput.value = beautified;
                    window.AllmightyUtils.showSuccess('Object extracted and beautified!');
                    return;
                } catch (objectError) {
                    // Continue to error message
                }
            }
        }
    }

    window.AllmightyUtils.showError('Could not beautify JSON. Please ensure it\'s valid JSON format.');
}

// Try to fix common partial JSON issues
function tryFixPartialJson(jsonText) {
    let fixed = jsonText.trim();

    // Remove trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Add missing quotes around property names
    fixed = fixed.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

    // Wrap with braces if it looks like an object but missing braces
    if (!fixed.startsWith('{') && !fixed.startsWith('[') && fixed.includes(':')) {
        fixed = `{${fixed}}`;
    }

    // Wrap with brackets if it looks like an array but missing brackets
    if (!fixed.startsWith('{') && !fixed.startsWith('[') && (fixed.includes(',') || fixed.includes(':\s*['))) {
        fixed = `[${fixed}]`;
    }

    return fixed;
}

// Make beautifyJson available globally
window.beautifyJson = beautifyJson;

// Global wrapper function for safe module access
function convertJson() {
    if (window.JsonToTable && window.JsonToTable.convert) {
        window.JsonToTable.convert();
    } else {
        // Fallback: call the function directly
        convertJsonToTable();
    }
}

// Make convertJson available globally
window.convertJson = convertJson;

// Extract JSON path for partial data processing
function extractJsonPath(jsonPath, jsonData) {
    try {
        console.log('Extracting path:', jsonPath, 'from data:', jsonData);

        // Handle simple dot notation and array access
        const parts = jsonPath.split('.');
        let current = jsonData;

        for (const part of parts) {
            if (!current) return null;

            // Handle array access [index] notation
            const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
            if (arrayMatch) {
                const [_, propName, index] = arrayMatch;
                current = current[propName];
                if (Array.isArray(current)) {
                    current = current[parseInt(index)];
                }
            } else {
                current = current[part];
            }
        }

        console.log('Extracted data:', current);
        return current;
    } catch (error) {
        console.warn('Error extracting JSON path:', error);
        return null;
    }
}

// Get available paths from JSON object
function getAvailablePaths(obj, prefix = '', paths = []) {
    if (typeof obj !== 'object' || obj === null) {
        return paths;
    }

    if (Array.isArray(obj)) {
        paths.push(prefix + '[]');
        if (obj.length > 0 && typeof obj[0] === 'object') {
            getAvailablePaths(obj[0], prefix + '[0]', paths);
        }
        return paths;
    }

    for (const [key, value] of Object.entries(obj)) {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        paths.push(currentPath);

        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                // For arrays, add both the array path and sample element paths
                if (value.length > 0) {
                    if (typeof value[0] === 'object') {
                        // Add path to array and also to first element for inspection
                        getAvailablePaths(value[0], currentPath + '[0]', paths);
                    } else {
                        // For primitive arrays, just note it's an array
                        paths.push(currentPath + '[]');
                    }
                }
            } else {
                getAvailablePaths(value, currentPath, paths);
            }
        }
    }

    return paths;
}


// Show JSON path explorer
function showPathExplorer() {
    const jsonInput = document.getElementById('jsonInput');
    if (!jsonInput) return;

    const jsonText = jsonInput.value.trim();
    if (!jsonText || jsonText.includes('Paste your JSON data here')) {
        window.AllmightyUtils.showError('Please enter JSON data first');
        return;
    }

    try {
        const jsonData = JSON.parse(jsonText);
        const paths = getAvailablePaths(jsonData);

        if (paths.length === 0) {
            window.AllmightyUtils.showError('No extractable paths found in JSON');
            return;
        }

        // Show path selection modal or dropdown
        showPathSelection(paths);

    } catch (error) {
        window.AllmightyUtils.showError('Invalid JSON: ' + error.message);
    }
}

// Show path selection interface
function showPathSelection(paths) {
    // Create a simple selection dialog
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #4facfe;
        border-radius: 8px;
        padding: 20px;
        max-width: 500px;
        max-height: 400px;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    modal.innerHTML = `
        <h3 class="h5 mb-3">🔍 Explore JSON Paths</h3>
        <p class="text-muted small mb-3">Select a path to extract specific data, or use full JSON:</p>
        <div class="mb-3">
            <select id="pathSelect" size="8" class="form-select font-monospace" style="height: auto;">
                <option value="">📄 Use full JSON (no path)</option>
                ${paths.map(path => `<option value="${path}">📂 ${path}</option>`).join('')}
            </select>
        </div>
        <div class="d-flex gap-2 justify-content-end">
            <button class="btn btn-outline-secondary btn-sm" onclick="cancelPathSelection()">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="selectPathAndClose()">Select & Close</button>
        </div>
    `;

    // Add to page
    document.body.appendChild(modal);

    // Make the select function global
    window.selectPathAndClose = function() {
        const select = document.getElementById('pathSelect');
        const pathInput = document.getElementById('jsonPath');
        const pathDisplay = document.getElementById('currentPathDisplay');

        if (pathInput) {
            pathInput.value = select.value || '';

            if (pathDisplay) {
                if (select.value) {
                    pathDisplay.textContent = `📂 ${select.value}`;
                    pathDisplay.style.color = '#4facfe';
                    window.AllmightyUtils.showInfo(`Selected path: ${select.value}. Click "Convert" to process.`);
                } else {
                    pathDisplay.textContent = '📄 Full JSON (no path selected)';
                    pathDisplay.style.color = '#666';
                    window.AllmightyUtils.showInfo('Using full JSON. Click "Convert" to process.');
                }
            }
        }
        modal.remove();
    };

    // Make the cancel function global
    window.cancelPathSelection = function() {
        modal.remove();
        // Do nothing else - just close without changes
    };
}

// Handle "Go to column" dropdown search functionality
window.searchAndGoToColumn = function(e) {
    // Handle both event and direct input
    const input = (e && e.target) ? e.target : (e && e.value) ? e : null;

    // If no valid input found, try to get it by ID
    if (!input) {
        return;
    }

    const searchTerm = (input.value || '').trim().toLowerCase();
    const suggestions = document.getElementById('columnSuggestions');

    // Get columns from availableColumns or currentColumns
    const columns = availableColumns.length > 0 ? availableColumns : currentColumns;

    if (!columns.length) {
        showNoColumnsMessage();
        return;
    }

    // Filter columns with "like" style search (contains, case-insensitive)
    const filteredColumns = columns.filter(col => {
        if (!searchTerm) return true; // Show all when search is empty
        return col.toLowerCase().includes(searchTerm);
    });

    // Sort results: exact matches first, then alphabetical
    filteredColumns.sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aExact = aLower === searchTerm;
        const bExact = bLower === searchTerm;

        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.localeCompare(b);
    });

    // Store filtered columns globally for keyboard navigation
    window.filteredColumns = filteredColumns;

    if (filteredColumns.length > 0) {
        showColumnDropdown(filteredColumns, searchTerm);
    } else {
        showNoResultsMessage(searchTerm);
    }
};

// Show column dropdown with filtered results
function showColumnDropdown(columns, searchTerm) {
    const suggestions = document.getElementById('columnSuggestions');
    if (!suggestions) return;

    const htmlContent = columns.map((col, index) => {
        // Highlight matching parts
        let displayName = col;
        if (searchTerm && searchTerm.length > 0) {
            const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            displayName = col.replace(regex, '<mark class="bg-warning">$1</mark>');
        }

        // Show column hierarchy with indentation
        const level = getColumnLevel(col);
        const indentClass = level > 0 ? `suggestion-level-${Math.min(level, 4)}` : '';

        // Escape single quotes for JavaScript
        const escapedCol = col.replace(/'/g, "\\'");

        return `
            <div class="suggestion-item ${indentClass} hover:bg-light cursor-pointer p-2 border-bottom"
                 role="option" data-column="${window.AllmightyUtils.escapeHtml(col)}">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="column-name">${displayName}</span>
                    <span class="text-muted small">Col ${index + 1}</span>
                </div>
            </div>
        `;
    }).join('');

    suggestions.innerHTML = htmlContent;

    // Add event listeners to each suggestion item
    const suggestionItems = suggestions.querySelectorAll('.suggestion-item');
    suggestionItems.forEach((item, index) => {
        const columnName = columns[index];
        item.addEventListener('click', () => {
            console.log('Clicked column:', columnName);
            goToColumn(columnName);
        });
    });

    // Show dropdown by removing d-none and adding show
    suggestions.classList.remove('d-none');
    suggestions.classList.add('show');

    // Update ARIA attributes
    const searchInput = document.getElementById('columnSearch');
    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'true');
    }
}

// Show message when no columns are available
function showNoColumnsMessage() {
    const suggestions = document.getElementById('columnSuggestions');
    if (!suggestions) return;

    suggestions.innerHTML = `
        <div class="suggestion-item p-4 text-muted text-center">
            <div class="d-flex align-items-center gap-2 justify-content-center">
                <span>📊</span>
                <span>No columns available</span>
            </div>
            <div class="small text-muted mt-2">
                Convert JSON data first to see columns
            </div>
        </div>
    `;

    suggestions.classList.remove('d-none');
    suggestions.classList.add('show');

    // Update ARIA attributes
    const searchInput = document.getElementById('columnSearch');
    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'true');
    }
}

// Show message when no search results found
function showNoResultsMessage(searchTerm) {
    const suggestions = document.getElementById('columnSuggestions');
    if (!suggestions) return;

    suggestions.innerHTML = `
        <div class="suggestion-item p-4 text-muted text-center">
            <div class="d-flex align-items-center gap-2 justify-content-center">
                <span>🔍</span>
                <span>No columns found for "${window.AllmightyUtils.escapeHtml(searchTerm)}"</span>
            </div>
            <div class="small text-muted mt-2">
                Try a different search term
            </div>
        </div>
    `;

    suggestions.classList.remove('d-none');
    suggestions.classList.add('show');

    // Update ARIA attributes
    const searchInput = document.getElementById('columnSearch');
    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'true');
    }
}

// Get column nesting level for indentation
function getColumnLevel(columnName) {
    return (columnName.match(/\./g) || []).length;
}


// Hide column dropdown
function hideColumnDropdown() {
    console.log('hideColumnDropdown called');
    const suggestions = document.getElementById('columnSuggestions');
    if (suggestions) {
        console.log('Hiding dropdown suggestions');
        suggestions.classList.remove('show');
        suggestions.classList.add('d-none');

        // Update ARIA attributes
        const searchInput = document.getElementById('columnSearch');
        if (searchInput) {
            searchInput.setAttribute('aria-expanded', 'false');
        }
    } else {
        console.log('Suggestions element not found');
    }
}

// Global search function for filtering all table data
window.applyGlobalSearch = function(searchTerm) {
    const searchInput = document.getElementById('columnSearch');
    if (!searchInput) return;

    const previousSearch = globalSearchFilter;
    globalSearchFilter = searchTerm ? searchTerm.trim().toLowerCase() : '';

    // Save to session storage
    try {
        if (globalSearchFilter) {
            sessionStorage.setItem(STORAGE_KEYS.GLOBAL_SEARCH, globalSearchFilter);
        } else {
            sessionStorage.removeItem(STORAGE_KEYS.GLOBAL_SEARCH);
        }
    } catch (e) {
        console.error('Failed to save global search to session storage:', e);
    }

    // Only reapply filters if search term actually changed
    if (previousSearch !== globalSearchFilter) {
        applyFiltersWithoutRender();
        scheduleTableRender();
        updatePaginationAsync();

        // Update visual feedback
        updateGlobalSearchVisualFeedback();

        // Update clear all filters button visibility
        updateClearAllFiltersButton();
    }
};

// Update visual feedback for global search
function updateGlobalSearchVisualFeedback() {
    const searchInput = document.getElementById('columnSearch');
    if (!searchInput) return;

    if (globalSearchFilter) {
        searchInput.classList.add('is-valid');
        searchInput.classList.remove('is-invalid');

        // Update placeholder to show active search
        const originalPlaceholder = searchInput.getAttribute('data-original-placeholder');
        if (!originalPlaceholder) {
            searchInput.setAttribute('data-original-placeholder', searchInput.placeholder);
        }
        searchInput.placeholder = `🔍 Searching: "${globalSearchFilter}"`;
    } else {
        searchInput.classList.remove('is-valid');

        // Restore original placeholder
        const originalPlaceholder = searchInput.getAttribute('data-original-placeholder');
        if (originalPlaceholder) {
            searchInput.placeholder = originalPlaceholder;
            searchInput.removeAttribute('data-original-placeholder');
        }
    }
}

// Restore global search from session storage
function restoreGlobalSearch() {
    try {
        const savedSearch = sessionStorage.getItem(STORAGE_KEYS.GLOBAL_SEARCH);
        if (savedSearch) {
            globalSearchFilter = savedSearch;
            const searchInput = document.getElementById('columnSearch');
            if (searchInput) {
                searchInput.value = savedSearch;
                updateGlobalSearchVisualFeedback();
            }
        }
    } catch (e) {
        console.error('Failed to restore global search from session storage:', e);
    }
}

// Handle search input - combines global search and column navigation
window.handleSearchInput = function(input) {
    const searchTerm = (input.value || '').trim();

    // Always apply global search when typing
    applyGlobalSearch(searchTerm);

    // Also show column navigation dropdown if there's text
    if (searchTerm) {
        searchAndGoToColumn(input);
    } else {
        // Hide dropdown when search is empty
        const suggestions = document.getElementById('columnSuggestions');
        if (suggestions) {
            suggestions.classList.add('d-none');
            suggestions.classList.remove('show');
        }
    }
};

// Handle search focus - show column navigation
window.handleSearchFocus = function(input) {
    const searchTerm = (input.value || '').trim();

    // Show column navigation dropdown on focus
    searchAndGoToColumn(input);
};

// Handle search keydown for special keys
window.handleSearchKeydown = function(event) {
    if (event.key === 'Escape') {
        // Clear search on Escape
        const input = document.getElementById('columnSearch');
        if (input) {
            input.value = '';
            applyGlobalSearch('');

            // Hide dropdown
            const suggestions = document.getElementById('columnSuggestions');
            if (suggestions) {
                suggestions.classList.add('d-none');
                suggestions.classList.remove('show');
            }
        }
        event.preventDefault();
    }
};

// Make functions globally available
window.showPathExplorer = showPathExplorer;
window.extractJsonPath = extractJsonPath;
window.searchAndGoToColumn = searchAndGoToColumn;
window.goToColumn = goToColumn;
window.clearAllFilters = clearAllFilters;
window.applyColumnFilter = applyColumnFilter;
window.applyGlobalSearch = applyGlobalSearch;
window.restoreGlobalSearch = restoreGlobalSearch;

// Main conversion function with async processing
async function convertJsonToTable() {
    const jsonInput = document.getElementById('jsonInput');
    const pathInput = document.getElementById('jsonPath');

    if (!jsonInput) {
        window.AllmightyUtils.showError('JSON input area not found');
        return;
    }

    const jsonText = jsonInput.value.trim();

    if (!jsonText || jsonText === '') {
        window.AllmightyUtils.showError('Please enter JSON data or select a file.');
        return;
    }

    // Check if the text looks like placeholder content
    if (jsonText.includes('Paste your JSON data here') || jsonText.includes('Examples:')) {
        window.AllmightyUtils.showError('Please enter actual JSON data, not placeholder text.');
        return;
    }

    // Prevent multiple simultaneous processing
    if (isProcessing) {
        window.AllmightyUtils.showError('Please wait for the current operation to complete.');
        return;
    }

    isProcessing = true;

    try {
        // Show processing state for large JSON
        if (jsonText.length > 50000) {
            showProcessingState('Processing large JSON...');
        }

        // Parse the complete JSON first
        const fullData = await parseJsonAsync(jsonText);

        let dataToProcess = fullData;
        const pathText = pathInput ? pathInput.value.trim() : '';

        // If a path is specified, extract that part
        if (pathText) {
            dataToProcess = extractJsonPath(pathText, fullData);
            if (dataToProcess === null) {
                window.AllmightyUtils.showError(`Could not find path: ${pathText}`);
                return;
            }
            console.log(`Extracted data from path: ${pathText}`, dataToProcess);
        }

        currentData = dataToProcess;

        // Clear previous messages
        window.AllmightyUtils.clearMessages();

        // Process data asynchronously with chunking for large datasets
        const { rows, columns } = await processDataAsync(dataToProcess);

        // Store processed data
        currentRows = rows;
        currentColumns = Array.from(columns).sort();
        availableColumns = currentColumns;

        // Initialize filtered data and clear filters
        filteredData = [...currentRows];
        columnFilters.clear();
        allUniqueValues.clear();
        globalSearchFilter = ''; // Clear global search

        // Compute and cache unique values for all columns
        computeAndCacheUniqueValues(rows, currentColumns);

        // Clear session storage search state
        try {
            sessionStorage.removeItem(STORAGE_KEYS.COLUMN_SEARCH);
            sessionStorage.removeItem(STORAGE_KEYS.GLOBAL_SEARCH);
        } catch (e) {
            console.error('Failed to clear search state from session storage:', e);
        }

        // Reset global search input
        const searchInput = document.getElementById('columnSearch');
        if (searchInput) {
            searchInput.value = '';
            updateGlobalSearchVisualFeedback();
        }

        // Reset pagination
        currentPage = 1;

        // Update pagination and render asynchronously
        await updatePaginationAsync();
        scheduleTableRender();

        // Show controls and stats
        updateDataStats(dataToProcess);
        window.AllmightyUtils.toggleExportControls(true);

        // Show stats area
        const statsArea = document.getElementById('statsArea');
        if (statsArea) {
            statsArea.style.display = 'flex';
        }

        // Show success message with path info
        if (pathText) {
            window.AllmightyUtils.showSuccess(`Converted data from path: ${pathText}`);
        } else {
            window.AllmightyUtils.showSuccess('Converted full JSON data');
        }

        // Refresh column search dropdown with new columns
        refreshColumnSearch();

        // Restore global search if it exists
        restoreGlobalSearch();

    } catch (error) {
        window.AllmightyUtils.showError(`Invalid JSON: ${error.message}`);
        console.error('JSON conversion error:', error);
    } finally {
        isProcessing = false;
        hideProcessingState();
    }
}

// Async JSON parsing with performance optimization
async function parseJsonAsync(jsonText) {
    return new Promise((resolve, reject) => {
        try {
            // Use setTimeout to prevent UI blocking
            setTimeout(() => {
                try {
                    const data = JSON.parse(jsonText);
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            }, 0);
        } catch (error) {
            reject(error);
        }
    });
}

// Async data processing with chunking for large datasets
async function processDataAsync(data) {
    let rows = [];
    let columns = new Set();

    // Optimized chunk processing with memory pooling
    const processChunkOptimized = (chunk, startIdx) => {
        return new Promise(chunkResolve => {
            // Use requestIdleCallback for better performance when available
            const scheduleMethod = window.requestIdleCallback || setTimeout;

            scheduleMethod(() => {
                try {
                    const chunkRows = new Array(chunk.length);
                    for (let i = 0; i < chunk.length; i++) {
                        chunkRows[i] = processFlattenedObject(chunk[i], columns, true);
                    }
                    chunkResolve(chunkRows);
                } catch (error) {
                    console.warn('Error processing chunk:', error);
                    chunkResolve([]);
                }
            }, { timeout: 50 }); // Maximum wait time
        });
    };

    // Optimized async array processing
    const processArrayOptimized = async (array) => {
        const results = [];
        const chunkSize = array.length > 10000 ? 50 : 100; // Dynamic chunk size

        // Process chunks in parallel for better performance
        const promises = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            const chunk = array.slice(i, Math.min(i + chunkSize, array.length));
            promises.push(processChunkOptimized(chunk, i));

            // Limit parallel promises to prevent overwhelming
            if (promises.length >= 5) {
                const chunkResults = await Promise.all(promises);
                results.push(...chunkResults.flat());
                promises.length = 0; // Clear array
            }
        }

        // Process remaining chunks
        if (promises.length > 0) {
            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults.flat());
        }

        return results;
    };

    try {
        // Process data based on type
        if (Array.isArray(data)) {
            // For very large arrays, show progress
            if (data.length > 1000) {
                showProcessingState(`Processing ${data.length} items...`);
            }

            rows = await processArrayOptimized(data);
        } else if (typeof data === 'object' && data !== null) {
            rows = [processFlattenedObject(data, columns, true)];
        } else {
            throw new Error('JSON must be an object or array of objects');
        }

        return { rows, columns: Array.from(columns) };
    } catch (error) {
        console.error('Error in processDataAsync:', error);
        throw error;
    }
}

// Generate table from JSON data
function generateTable(data, sortColumn = null, sortDirection = null) {
    let rows = [];
    let columns = new Set();

    // Process data based on its type
    if (Array.isArray(data)) {
        // Handle array of objects
        rows = data.map(item => processFlattenedObject(item, columns, true));
    } else if (typeof data === 'object' && data !== null) {
        // Handle single object
        rows = [processFlattenedObject(data, columns, true)];
    } else {
        throw new Error('JSON must be an object or array of objects');
    }

    // Store for sorting
    currentRows = rows;
    originalRows = [...rows]; // Store original unsorted rows
    currentColumns = Array.from(columns).sort();

    // Initialize filtered data and clear filters
    filteredData = [...currentRows];
    columnFilters.clear();
    allUniqueValues.clear();

    // Clear session storage search state
    try {
        sessionStorage.removeItem(STORAGE_KEYS.COLUMN_SEARCH);
    } catch (e) {
        console.error('Failed to clear search state from session storage:', e);
    }

    // Apply sorting if specified
    if (sortColumn && currentColumns.includes(sortColumn)) {
        rows = sortRows(rows, sortColumn, sortDirection);
    }

    // Generate HTML
    let html = '<table class="table table-striped table-hover table-bordered"><thead><tr><th>#</th>';
    currentColumns.forEach(col => {
        const hierarchyClass = getColumnHierarchyClass(col);
        const isArrayIndex = col.match(/\[\d+\]$/);
        const arrayClass = isArrayIndex ? ' array-index' : '';
        const sortIndicator = sortColumn === col ? (sortDirection === 'asc' ? ' ↑' : (sortDirection === 'desc' ? ' ↓' : '')) : '';

        html += `<th class="${hierarchyClass}${arrayClass}" onclick="toggleColumnSort('${col}')" title="Click to sort by ${window.AllmightyUtils.escapeHtml(col)}"><div class="header-chip">${window.AllmightyUtils.escapeHtml(col)}<span class="sort-indicator">${sortIndicator}</span></div></th>`;
    });
    html += '</tr></thead><tbody>';

    rows.forEach((row, index) => {
        html += `<tr><td><strong>${index + 1}</strong></td>`;
        currentColumns.forEach(col => {
            const cellValue = row[col] || '';
            const displayValue = window.AllmightyUtils.escapeHtml(window.AllmightyUtils.formatValue(cellValue));
            const isNumeric = isNumericColumn(col);
            const textClass = isNumeric ? 'text-end' : '';
            html += `<td class="${textClass}">${displayValue}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}

// Sort rows by column
function sortRows(rows, column, direction) {
    return [...rows].sort((a, b) => {
        const aVal = a[column] || '';
        const bVal = b[column] || '';

        // Try to parse as numbers for numeric sorting
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);

        let comparison;
        if (!isNaN(aNum) && !isNaN(bNum)) {
            comparison = aNum - bNum;
        } else {
            comparison = String(aVal).localeCompare(String(bVal));
        }

        return direction === 'asc' ? comparison : -comparison;
    });
}

// Toggle column sorting
function toggleColumnSort(column) {
    if (lastSortColumn === column && sortColumn === null) {
        // Continuing cycle after clearing: start with asc
        sortColumn = column;
        sortDirection = 'asc';
    } else if (sortColumn === column) {
        // Three-state cycle: asc -> desc -> none -> asc
        if (sortDirection === 'asc') {
            sortDirection = 'desc';
        } else if (sortDirection === 'desc') {
            // Clear sorting
            sortColumn = null;
            sortDirection = null; // Set to null to indicate no sort
        }
    } else {
        // New column, default to ascending
        sortColumn = column;
        sortDirection = 'asc';
    }

    // Always track the last clicked column
    lastSortColumn = column;

    // Re-sort current rows instead of regenerating from scratch
    if (currentRows.length > 0) {
        if (sortColumn) {
            console.log(`Sorting column "${column}" in direction "${sortDirection}"`);
            currentRows = sortRows(currentRows, sortColumn, sortDirection);
        } else {
            console.log('Clearing sorting, restoring original order');
            // Restore original order by regenerating table
            currentRows = [...originalRows];
        }

        // Apply filters and update pagination
        applyAllFilters();

        // Use scheduleTableRender to ensure search inputs are restored
        console.log('Calling scheduleTableRender after sorting');
        scheduleTableRender();
    }

    // Log sorting action
    if (window.AllmightyConversion && window.AllmightyConversion.config && window.AllmightyConversion.config.debug) {
        if (sortColumn) {
            console.log(`Sorting by ${column} (${sortDirection})`);
        } else {
            console.log('Sorting cleared');
        }
    }
}

// Determine column hierarchy class based on nesting depth
function getColumnHierarchyClass(columnName) {
    // Count the depth of nesting by counting dots and array brackets
    const dotCount = (columnName.match(/\./g) || []).length;
    const arrayBracketCount = (columnName.match(/\[/g) || []).length;
    const totalDepth = dotCount + arrayBracketCount;

    // Map depth to color classes
    switch (totalDepth) {
        case 0: return 'level-0';  // Root level (id, name, etc.)
        case 1: return 'level-1';  // First level nested (address.street, user.name)
        case 2: return 'level-2';  // Second level (address.location.coordinates.lat)
        case 3: return 'level-3';  // Third level
        case 4: return 'level-4';  // Fourth level
        case 5: return 'level-5';  // Fifth level
        case 6: return 'level-6';  // Sixth level
        default: return 'level-deep'; // Very deep nesting
    }
}

// Process a flattened object and collect columns
function processFlattenedObject(obj, columns, isRoot = false) {
    const flattened = flattenObjectForDisplay(obj, columns);

    // Debug logging
    if (window.Almightycoon && window.Almightycoon.config && window.Almightycoon.config.debug) {
        console.log('Flattened object:', flattened);
        console.log('Columns collected:', Array.from(columns));
    }

    return flattened;
}

// Optimized flatten object for display with reduced object allocations
function flattenObjectForDisplay(obj, headers, prefix = '') {
    const flattened = {};

    // Use for...in loop for better performance on large objects
    for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;

        const value = obj[key];
        const fullKey = prefix ? `${prefix}.${key}` : key;

        // Optimized type checking with switch statement
        const valueType = typeof value;

        if (valueType === 'object' && value !== null) {
            if (Array.isArray(value)) {
                // Optimized array processing
                const arrayLength = value.length;
                for (let i = 0; i < arrayLength; i++) {
                    const item = value[i];
                    const arrayKey = `${fullKey}[${i}]`;
                    const itemType = typeof item;

                    if (itemType === 'object' && item !== null) {
                        if (Array.isArray(item)) {
                            // Handle nested arrays
                            Object.assign(flattened, flattenObjectForDisplay(item, headers, arrayKey));
                        } else {
                            // Flatten array objects
                            Object.assign(flattened, flattenObjectForDisplay(item, headers, arrayKey));
                        }
                    } else {
                        // Handle primitive array items
                        flattened[arrayKey] = item;
                        headers.add(arrayKey);
                    }
                }
            } else {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObjectForDisplay(value, headers, fullKey));
            }
        } else if (valueType === 'string') {
            // Optimized JSON string detection and parsing
            const parsedJson = window.AllmightyUtils.tryParseJson(value);
            if (parsedJson !== null) {
                // Debug logging for JSON string parsing (only in debug mode)
                if (window.Almightycoon && window.Almightycoon.config && window.Almightycoon.config.debug) {
                    console.log(`Parsed JSON string for key "${fullKey}":`, parsedJson);
                }
                // Flatten the parsed JSON
                Object.assign(flattened, flattenObjectForDisplay(parsedJson, headers, fullKey));
            } else {
                flattened[fullKey] = value;
                headers.add(fullKey);
            }
        } else {
            // Handle primitive values (number, boolean, etc.)
            flattened[fullKey] = value;
            headers.add(fullKey);
        }
    }

    return flattened;
}

// Update data statistics
function updateDataStats(data) {
    let rowCount = 0;
    let colCount = 0;
    let nestedCount = 0;

    if (Array.isArray(data)) {
        rowCount = data.length;
        if (data.length > 0) {
            // Count flattened columns
            const allColumns = new Set();
            data.forEach(item => {
                nestedCount += countNestedFields(item);
                flattenObjectForDisplay(item, allColumns);
            });
            colCount = allColumns.size;
        }
    } else {
        rowCount = 1;
        const allColumns = new Set();
        nestedCount = countNestedFields(data);
        flattenObjectForDisplay(data, allColumns);
        colCount = allColumns.size;
    }

    window.AllmightyUtils.updateStats(rowCount, colCount, nestedCount);
}

// Count nested fields in object
function countNestedFields(obj) {
    let count = 0;
    Object.values(obj).forEach(value => {
        if (typeof value === 'object' && value !== null) {
            if (!Array.isArray(value)) {
                count++;
                count += countNestedFields(value);
            } else {
                // Count arrays as nested fields too
                count++;
                value.forEach(item => {
                    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                        count += countNestedFields(item);
                    }
                });
            }
        } else if (typeof value === 'string') {
            // Check if string contains JSON that can be parsed
            const parsedJson = window.AllmightyUtils.tryParseJson(value);
            if (parsedJson !== null) {
                count++;
                count += countNestedFields(parsedJson);
            }
        }
    });
    return count;
}

// Export to CSV
function exportToCsv() {
    if (!currentData) {
        window.AllmightyUtils.showError('No data to export');
        return;
    }

    try {
        let csvContent = '';
        let headers = new Set();
        let rows = [];

        // Process data
        if (Array.isArray(currentData)) {
            rows = currentData.map(item => flattenObjectForCsv(item, headers));
        } else {
            rows = [flattenObjectForCsv(currentData, headers)];
        }

        // Convert headers set to array and sort
        headers = Array.from(headers).sort();

        // Create CSV header
        csvContent += headers.join(',') + '\n';

        // Create CSV rows
        rows.forEach(row => {
            const values = headers.map(header => {
                const value = row[header] || '';
                return window.AllmightyUtils.escapeCsvValue(value);
            });
            csvContent += values.join(',') + '\n';
        });

        // Download the file
        const filename = `allmighty-conversion-${Date.now()}.csv`;
        window.AllmightyUtils.downloadFile(csvContent, filename, 'text/csv');

        window.AllmightyUtils.showSuccess('CSV file downloaded successfully!');

    } catch (error) {
        window.AllmightyUtils.showError(`Export failed: ${error.message}`);
    }
}

// Flatten object for CSV export
function flattenObjectForCsv(obj, headers, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Recursively flatten nested objects
            Object.assign(flattened, flattenObjectForCsv(value, headers, fullKey));
        } else if (Array.isArray(value)) {
            // Recursively flatten arrays with index notation for CSV
            value.forEach((item, index) => {
                const arrayKey = `${fullKey}[${index}]`;
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    // Flatten array objects
                    Object.assign(flattened, flattenObjectForCsv(item, headers, arrayKey));
                } else if (Array.isArray(item)) {
                    // Handle nested arrays
                    Object.assign(flattened, flattenObjectForCsv(item, headers, arrayKey));
                } else {
                    // Handle primitive array items
                    flattened[arrayKey] = item;
                    headers.add(arrayKey);
                }
            });
        } else if (typeof value === 'string') {
            // Check if string contains JSON that can be parsed
            const parsedJson = window.AllmightyUtils.tryParseJson(value);
            if (parsedJson !== null) {
                // Flatten the parsed JSON
                Object.assign(flattened, flattenObjectForDisplay(parsedJson, headers, fullKey));
            } else {
                flattened[fullKey] = value;
                headers.add(fullKey);
            }
        } else {
            flattened[fullKey] = value;
            headers.add(fullKey);
        }
    }

    return flattened;
}

// Export functions for global access
window.JsonToTable = {
    init: initJsonToTable,
    convert: convertJsonToTable,
    exportToCsv: exportToCsv,
    generateTable: generateTable,
    flattenObject: flattenObjectForDisplay,
    currentData: () => currentData,
    toggleColumnSort: toggleColumnSort
};

// Ensure global functions are available for HTML onclick handlers
window.beautifyJson = beautifyJson;
window.convertJson = convertJson;
window.toggleColumnSort = toggleColumnSort;

console.log('JSON to Table module loaded successfully with functions:', {
    beautifyJson: typeof window.beautifyJson,
    convertJson: typeof window.convertJson,
    toggleColumnSort: typeof window.toggleColumnSort,
    selectColumn: typeof window.selectColumn,
    goToPage: typeof window.goToPage,
    changePageSize: typeof window.changePageSize
});

// Extract unique values from a column (optimized)
function extractUniqueValues(columnName) {
    if (!currentRows || currentRows.length === 0) return [];

    const values = new Set();
    const maxValues = 1000; // Limit for performance

    // Use for loop instead of forEach for better performance
    for (let i = 0; i < currentRows.length && values.size < maxValues; i++) {
        const row = currentRows[i];
        const value = row[columnName];
        if (value !== null && value !== undefined) {
            const stringValue = String(value);
            // Skip very long values for performance
            if (stringValue.length <= 100) {
                values.add(stringValue);
            }
        }
    }

    // Convert to array and sort
    const result = Array.from(values);

    // If there are many values, just return the first portion
    if (result.length > 500) {
        return result.slice(0, 500).sort();
    }

    return result.sort();
}

// Generate filter options HTML
function generateFilterOptions(columnName, values) {
    // Get current applied selections from session storage
    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
    const appliedFilter = columnFilters[columnName] || { values: [] };
    const appliedValues = new Set(appliedFilter.values || []);

    // Check if we have temporary selections
    const tempValues = window.tempFilterSelections[columnName] || [];
    const tempValuesSet = new Set(tempValues);

    return values.map(value => {
        const escapedValue = window.AllmightyUtils.escapeHtml(value);
        // Use temp values if they exist, otherwise use applied values
        const isSelected = tempValuesSet.has(value) || appliedValues.has(value);
        const shortValue = escapedValue.length > 50 ? escapedValue.substring(0, 47) + '...' : escapedValue;

        return `
            <div class="column-filter-option ${isSelected ? 'selected' : ''}"
                 onclick="applyUniqueValueFilter('${currentColumns.indexOf(columnName) + 1}', '${window.AllmightyUtils.escapeHtml(columnName)}', '${escapedValue.replace(/'/g, "\\'")}')"
                 title="${escapedValue}">
                <span class="option-text">${shortValue}</span>
                ${isSelected ? '<span class="selection-indicator">✓</span>' : '<span class="selection-indicator"></span>'}
            </div>
        `;
    }).join('');
}

// Handle column header search filtering functionality
window.filterByColumn = function(columnIndex, columnName, searchValue) {
    console.log(`🔍 COLUMN SEARCH TRIGGERED: columnIndex=${columnIndex}, columnName="${columnName}", searchValue="${searchValue}"`);
    console.log('🔍 Available global functions:', Object.keys(window).filter(key => key.includes('filter')));

    // Clear existing timeout for this column
    if (searchTimeouts.has(columnIndex)) {
        clearTimeout(searchTimeouts.get(columnIndex));
    }

    // Debounced filtering to avoid too many rapid updates
    const timeoutId = setTimeout(() => {
        try {
            // Get current search state from session storage
            const searchState = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_SEARCH) || '{}');

            // Update the specific column search
            searchState[columnName] = searchValue;

            // Save back to session storage
            sessionStorage.setItem(STORAGE_KEYS.COLUMN_SEARCH, JSON.stringify(searchState));

            console.log(`✅ Applying column search for ${columnName}: "${searchValue}"`);

            // Apply filtering immediately for better user experience
            applySearchFromStorage();

        } catch (e) {
            console.error('❌ Failed to save search state to session storage:', e);
        }
    }, 50); // 50ms debounce for filtering

    searchTimeouts.set(columnIndex, timeoutId);
};

// Handle column header search input focus
window.setColumnSearchFocus = function(columnIndex) {
    focusedColumnInput = columnIndex;

    // Clear any pending render timeout
    if (renderTimeoutId) {
        clearTimeout(renderTimeoutId);
        renderTimeoutId = null;
    }
}

// Handle column header search input blur
window.setColumnSearchBlur = function(columnIndex) {
    focusedColumnInput = null;

    // Schedule a render after a short delay to process any pending changes
    if (renderTimeoutId) {
        clearTimeout(renderTimeoutId);
    }

    renderTimeoutId = setTimeout(() => {
        if (isSearchDirty) {
            applySearchFromStorage();
            isSearchDirty = false;
        }
    }, 100); // Very short delay to allow for any debounced search to complete
}

// Bind event listeners to column search inputs after table render
function bindColumnSearchEventListeners() {
    console.log('🔧 Binding event listeners to column search inputs');

    currentColumns.forEach((columnName, index) => {
        const columnIndex = index + 1; // +1 because column 0 is the row number
        const searchInput = document.getElementById(`col-search-${columnIndex}`);

        if (searchInput) {
            console.log(`✅ Found search input: col-search-${columnIndex} for column "${columnName}"`);

            // Remove existing listeners to avoid duplicates
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);

            // Add event listeners
            newSearchInput.addEventListener('keyup', function(e) {
                console.log(`🔥 Keyup event on col-search-${columnIndex}: "${e.target.value}"`);
                window.filterByColumn(columnIndex, columnName, e.target.value);
            });

            newSearchInput.addEventListener('focus', function(e) {
                window.setColumnSearchFocus(columnIndex);
            });

            newSearchInput.addEventListener('blur', function(e) {
                window.setColumnSearchBlur(columnIndex);
            });

            newSearchInput.addEventListener('click', function(e) {
                e.stopPropagation();
            });

            console.log(`✅ Bound event listeners to col-search-${columnIndex}`);
        } else {
            console.warn(`❌ Search input not found: col-search-${columnIndex} for column "${columnName}"`);
        }
    });
}

// Initialize session storage listener for search changes
function initializeSearchListener() {
    // Listen for storage changes (works across tabs)
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.COLUMN_SEARCH) {
            applySearchFromStorage();
        }
    });

    // Also listen for changes in the same tab (storage event doesn't fire in same tab)
    const originalSetItem = sessionStorage.setItem;
    sessionStorage.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        if (key === STORAGE_KEYS.COLUMN_SEARCH) {
            // Dispatch custom event for same-tab communication
            window.dispatchEvent(new CustomEvent('sessionStorageChange', {
                detail: { key, value }
            }));
        }
    };

    // Listen for custom events
    window.addEventListener('sessionStorageChange', (e) => {
        if (e.detail.key === STORAGE_KEYS.COLUMN_SEARCH) {
            applySearchFromStorage();
        }
    });
}

// Apply search filters from session storage
function applySearchFromStorage() {
    try {
        const searchState = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_SEARCH) || '{}');

        let hasChanges = false;

        // Update column filters from session storage
        Object.entries(searchState).forEach(([columnName, searchValue]) => {
            const filter = columnFilters.get(columnName) || { search: '', values: new Set() };

            // Test if search value is valid regex when it contains regex characters
            if (searchValue && /[*+?^${}()|[\]\\]/.test(searchValue)) {
                try {
                    new RegExp(searchValue);
                    filter.search = searchValue;
                } catch (e) {
                    // Invalid regex, treat as literal search
                    filter.search = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                }
            } else {
                filter.search = searchValue;
            }

            columnFilters.set(columnName, filter);
            hasChanges = true;
        });

        // Clear filters for columns that are no longer in search state
        columnFilters.forEach((filter, columnName) => {
            if (!searchState.hasOwnProperty(columnName) && filter.search) {
                filter.search = '';
                columnFilters.set(columnName, filter);
                hasChanges = true;
            }
        });

        if (hasChanges) {
            applyFiltersWithoutRender();

            if (focusedColumnInput !== null) {
                // Input is focused, mark as dirty and use background update
                console.log(`Input col-${focusedColumnInput} is focused, using background update`);
                isSearchDirty = true;
                performBackgroundUpdate();
            } else {
                // No input focused, use normal render
                scheduleTableRender();
            }
        }
    } catch (e) {
        console.error('Failed to apply search from session storage:', e);
    }
}

// Apply filters without triggering immediate render
function applyFiltersWithoutRender() {
    if (!currentRows || currentRows.length === 0) {
        filteredData = [];
        return;
    }

    console.log('🔍 Applying filters with columnFilters:', Array.from(columnFilters.entries()));
    console.log('🔍 Current columns:', currentColumns);
    console.log('🔍 Column filter details:');
    columnFilters.forEach((filter, columnName) => {
        console.log(`  - ${columnName}:`, filter);
    });

    filteredData = currentRows.filter((row, index) => {
        // Apply global search filter first
        if (globalSearchFilter) {
            let globalMatch = false;
            for (const columnName of currentColumns) {
                const cellValue = row[columnName];
                const cellString = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';

                if (cellString.toLowerCase().includes(globalSearchFilter)) {
                    globalMatch = true;
                    break;
                }
            }
            if (!globalMatch) return false;
        }

        // Check each column filter
        for (const [columnName, filter] of columnFilters.entries()) {
            const cellValue = row[columnName];
            const cellString = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';

            console.log(`🔍 Row ${index}: Checking column "${columnName}" with value:`, cellValue, `(as string: "${cellString}")`, `searching for: "${filter.search}"`);

            // Apply search filter
            if (filter.search) {
                let matches = false;
                try {
                    const regex = new RegExp(filter.search, 'i');
                    matches = regex.test(cellString);
                } catch (e) {
                    // Fallback to literal search if regex is invalid
                    matches = cellString.toLowerCase().includes(filter.search.toLowerCase());
                }

                console.log(`🔍 Row ${index}: ${columnName} "${cellString}" matches "${filter.search}"? ${matches}`);

                if (!matches) return false;
            }

            // Apply value filter
            if (filter.values.size > 0) {
                if (!filter.values.has(cellString)) return false;
            }
        }

        return true;
    });

    console.log('🔍 Filtered result:', {
        originalRows: currentRows.length,
        filteredRows: filteredData.length,
        filteredData: filteredData
    });

    // Reset to first page
    currentPage = 1;
}

// Show unique values dropdown for [v] button
window.showColumnUniqueValues = function(columnIndex, columnName, event) {
    event.stopPropagation();

    console.log(`[V-CLICK] ${columnName}`);

    const button = document.getElementById(`col-filter-btn-${columnIndex}`);
    const dropdown = document.getElementById(`col-filter-dropdown-${columnIndex}`);
    const allDropdowns = document.querySelectorAll('.column-filter-dropdown');

    if (!button || !dropdown) {
        console.error('Required elements not found', { buttonId: `col-filter-btn-${columnIndex}`, dropdownId: `col-filter-dropdown-${columnIndex}` });
        return;
    }

    // Close all other dropdowns
    allDropdowns.forEach(d => {
        if (d !== dropdown) {
            d.classList.remove('show');
        }
    });

    // Toggle current dropdown
    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        return;
    }

    // Simple positioning relative to button
    const buttonRect = button.getBoundingClientRect();

    dropdown.style.position = 'fixed';
    dropdown.style.top = `${buttonRect.bottom + 2}px`;
    dropdown.style.left = `${buttonRect.left}px`;
    dropdown.style.width = `${Math.max(220, Math.min(300, buttonRect.width))}px`;
    dropdown.style.zIndex = '999999';

    dropdown.classList.add('show');
    console.log(`[DROPDOWN-SHOW] ${columnName} show class added`);

    // Clear any temporary selections for this column when opening dropdown
    delete window.tempFilterSelections[columnName];

    // Generate unique values from data with all filters EXCEPT the current column
    console.log(`[V-GEN] ${columnName}`);

    generateUniqueValueOptionsExcludingColumn(columnIndex, columnName);
    updateDropdownCheckboxes(columnIndex, columnName);

    // Ensure dropdown is visible after generation
    setTimeout(() => {
        dropdown.classList.add('show');
        console.log(`[DROPDOWN-RESHOW] ${columnName} ensured visible`);
    }, 50);

    // Remove any existing global click handler to avoid duplicates
    if (window.currentDropdownHandler) {
        document.removeEventListener('click', window.currentDropdownHandler);
    }

    // Global click handler to close dropdowns
    window.currentDropdownHandler = function(e) {
        // Close all dropdowns when clicking outside any button or dropdown
        const allButtons = document.querySelectorAll('.column-filter-button');
        const allDropdowns = document.querySelectorAll('.column-filter-dropdown');

        let clickedOnButtonOrDropdown = false;
        allButtons.forEach(btn => {
            if (btn.contains(e.target)) clickedOnButtonOrDropdown = true;
        });
        allDropdowns.forEach(dd => {
            if (dd.contains(e.target)) clickedOnButtonOrDropdown = true;
        });

        if (!clickedOnButtonOrDropdown) {
            allDropdowns.forEach(dd => dd.classList.remove('show'));
            document.removeEventListener('click', window.currentDropdownHandler);
            window.currentDropdownHandler = null;
        }
    };

    // Add the global click handler
    setTimeout(() => {
        document.addEventListener('click', window.currentDropdownHandler);
        console.log(`[V-COMPLETE] ${columnName} dropdown setup complete, visible=${dropdown.classList.contains('show')}`);
    }, 50);
};

// Generate unique value options from data with all filters EXCEPT the specified column
function generateUniqueValueOptionsExcludingColumn(columnIndex, columnName, isClearing = false) {
    const optionsContainer = document.getElementById(`col-filter-options-${columnIndex}`);
    console.log(`[GEN-START] ${columnName} clear=${isClearing} container=${!!optionsContainer}`);
    if (!optionsContainer) {
        console.log(`[GEN-ERROR] ${columnName} container not found`);
        return;
    }

    // Get filters from session storage
    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');

    // Filter data with all columns EXCEPT the current column
    const dataToShow = currentRows.filter(row => {
        // Check each column filter except the current one
        for (const [filterColumnName, filter] of Object.entries(columnFilters)) {
            // Skip the current column (we want all values for this column)
            if (filterColumnName === columnName) continue;

            const cellValue = row[filterColumnName];
            const cellString = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';

            // Apply search filter
            if (filter.search) {
                let matches = false;
                try {
                    const regex = new RegExp(filter.search, 'i');
                    matches = regex.test(cellString);
                } catch (e) {
                    // Fallback to literal search if regex is invalid
                    matches = cellString.toLowerCase().includes(filter.search.toLowerCase());
                }
                if (!matches) return false;
            }

            // Apply value filter
            if (filter.values && filter.values.length > 0) {
                const hasMatchingValue = filter.values.some(selectedValue => selectedValue === cellString);
                if (!hasMatchingValue) return false;
            }
        }
        return true;
    });

    // Get unique values from cache (computed once during JSON load)
    const cachedValues = getUniqueValuesFromCache(columnName);

    // If we have no cached values, fall back to computing from filtered data
    let uniqueValues;
    if (cachedValues.length > 0) {
        uniqueValues = cachedValues;
        console.log(`[CACHE-HIT] ${columnName} using ${uniqueValues.length} cached values`);
    } else {
        console.log(`[CACHE-MISS] ${columnName} computing from filtered data`);
        // Fallback: Extract unique values from filtered data
        const values = new Set();
        dataToShow.forEach(row => {
            const value = row[columnName];
            if (value !== null && value !== undefined) {
                values.add(String(value));
            }
        });

        // Convert to array and sort
        uniqueValues = Array.from(values).sort((a, b) => {
            // Try numeric sort first, fallback to string sort
            const aNum = parseFloat(a);
            const bNum = parseFloat(b);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            return a.localeCompare(b);
        });
    }

    // Generate HTML using the existing template
    const maxOptions = 100;
    const limitedValues = uniqueValues.slice(0, maxOptions);

    console.log(`[GEN-DATA] ${columnName} filtered=${dataToShow.length} unique=${uniqueValues.length} limited=${limitedValues.length}`);

    if (limitedValues.length === 0) {
        console.log('No values found, showing "No values found" message');
        optionsContainer.innerHTML = `
            <div class="column-filter-option p-3 text-gray-500 text-center">
                No values found in filtered data
            </div>
        `;
        return;
    }

    // Generate HTML using the same pattern as generateUniqueValueOptions
    let html = '';
    limitedValues.forEach(value => {
        const displayValue = window.AllmightyUtils.escapeHtml(String(value));
        const truncatedValue = displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue;

        html += `
            <div class="column-filter-option p-2.5 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                 onclick="applyUniqueValueFilter('${columnIndex}', '${columnName}', '${displayValue.replace(/'/g, "\\'")}')"
                 data-value="${displayValue.replace(/"/g, '&quot;')}"
                 title="${displayValue.replace(/"/g, '&quot;')}">
                <input type="checkbox"
                       class="mr-2 cursor-pointer"
                       onclick="event.stopPropagation()">
                <span class="flex-1 text-sm" title="${displayValue.replace(/"/g, '&quot;')}">${truncatedValue}</span>
                ${displayValue.length > 50 ? `<span class="text-xs text-gray-400">${displayValue.length} chars</span>` : ''}
            </div>
        `;
    });

    if (uniqueValues.length > maxOptions) {
        html += `
            <div class="column-filter-option p-2.5 text-gray-500 text-center text-xs">
                Showing ${maxOptions} of ${uniqueValues.length} unique values
            </div>
        `;
    }

    console.log(`[GEN-HTML] ${columnName} length=${html.length}`);

    optionsContainer.innerHTML = html;
    console.log(`[GEN-RESULT] ${columnName} children=${optionsContainer.children.length}`);

    // Verify the actual DOM state immediately after insertion
    setTimeout(() => {
        const actualChildren = optionsContainer.children;
        const actualHTML = optionsContainer.innerHTML;
        console.log(`[GEN-VERIFY] ${columnName} actualChildren=${actualChildren.length} htmlLength=${actualHTML.length}`);

        // Check first few characters of actual HTML
        if (actualHTML.length > 0) {
            console.log(`[GEN-VERIFY] ${columnName} htmlPreview=${actualHTML.substring(0, 100)}`);
        } else {
            console.log(`[GEN-VERIFY] ${columnName} htmlEmpty=true`);
        }

        // Check CSS computed styles for the options container
        const computedStyle = window.getComputedStyle(optionsContainer);
        console.log(`[GEN-CSS] ${columnName} display=${computedStyle.display} visibility=${computedStyle.visibility} height=${computedStyle.height} overflow=${computedStyle.overflow}`);
    }, 0);

    // Only force uncheck checkboxes when clearing a filter (not when opening dropdown)
    if (isClearing) {
        setTimeout(() => {
            const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');
            console.log('Found checkboxes to uncheck:', checkboxes.length);
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
                checkbox.removeAttribute('checked');
            });
            console.log('Force unchecked all checkboxes in generateUniqueValueOptionsExcludingColumn (Clear mode)');
        }, 0);
    }
}

// Generate unique value options from filtered data
function generateUniqueValueOptions(columnIndex, columnName) {
    console.log('=== GENERATE UNIQUE VALUE OPTIONS START ===');
    console.log('generateUniqueValueOptions called with:', { columnIndex, columnName });

    const optionsContainer = document.getElementById(`col-filter-options-${columnIndex}`);
    console.log('Looking for options container with ID:', `col-filter-options-${columnIndex}`);
    console.log('Options container found:', !!optionsContainer);
    if (!optionsContainer) {
        console.log('Options container not found, returning early');
        return;
    }
    console.log('Options container element:', optionsContainer);
    console.log('Options container innerHTML length:', optionsContainer.innerHTML.length);
    console.log('Options container children count:', optionsContainer.children.length);
    console.log('Options container current content:', optionsContainer.innerHTML.substring(0, 100));

    // Get values from currently filtered data (not original data)
    const dataToShow = filteredData.length > 0 ? filteredData : currentRows;
    console.log('Data source: filteredData.length =', filteredData.length, ', currentRows.length =', currentRows.length);
    console.log('Using dataToShow.length =', dataToShow.length);

    // Extract unique values for this column
    console.log('Starting value extraction from', dataToShow.length, 'rows');
    const values = new Set();
    dataToShow.forEach((row, index) => {
        const value = row[columnName];
        console.log(`Row ${index}: ${columnName} =`, value);
        if (value !== null && value !== undefined) {
            values.add(String(value));
        }
    });
    console.log('Extracted values:', Array.from(values));

    // Convert to array and sort
    const uniqueValues = Array.from(values).sort((a, b) => {
        // Try numeric sort first, fallback to string sort
        const aNum = parseFloat(a);
        const bNum = parseFloat(b);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }
        return a.localeCompare(b);
    });
    console.log('Sorted unique values:', uniqueValues);

    // Limit to reasonable number of options
    const maxOptions = 100;
    const limitedValues = uniqueValues.slice(0, maxOptions);

    if (limitedValues.length === 0) {
        optionsContainer.innerHTML = `
            <div class="column-filter-option p-3 text-gray-500 text-center">
                No values found in filtered data
            </div>
        `;
        return;
    }

    // Generate HTML
    let html = '';
    limitedValues.forEach(value => {
        const displayValue = window.AllmightyUtils.escapeHtml(String(value));
        const truncatedValue = displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue;

        html += `
            <div class="column-filter-option p-2.5 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                 onclick="applyUniqueValueFilter('${columnIndex}', '${columnName}', '${displayValue.replace(/'/g, "\\'")}')"
                 data-value="${displayValue.replace(/"/g, '&quot;')}"
                 title="${displayValue.replace(/"/g, '&quot;')}">
                <input type="checkbox"
                       class="mr-2 cursor-pointer"
                       onclick="event.stopPropagation()">
                <span class="flex-1 text-sm" title="${displayValue.replace(/"/g, '&quot;')}">${truncatedValue}</span>
                ${displayValue.length > 50 ? `<span class="text-xs text-gray-400">${displayValue.length} chars</span>` : ''}
            </div>
        `;
    });

    if (uniqueValues.length > maxOptions) {
        html += `
            <div class="column-filter-option p-2.5 text-gray-500 text-center text-sm italic">
                ... and ${uniqueValues.length - maxOptions} more values
            </div>
        `;
    }

    optionsContainer.innerHTML = html;
}

// Apply filter based on unique value selection
// Store temporary filter selections (not yet applied)
window.tempFilterSelections = {};

// Update selection when clicking on options (without applying filter)
window.applyUniqueValueFilter = function(columnIndex, columnName, value) {
    event.stopPropagation();

    console.log('Toggling selection:', { columnIndex, columnName, value });

    // Initialize temp selections for this column if not exists
    if (!window.tempFilterSelections[columnName]) {
        // Load current applied selections as starting point
        const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
        const currentFilter = columnFilters[columnName] || { values: [] };
        window.tempFilterSelections[columnName] = [...(currentFilter.values || [])];
    }

    // Toggle the value in temporary selections
    const tempValues = window.tempFilterSelections[columnName];
    const valueIndex = tempValues.indexOf(value);
    if (valueIndex > -1) {
        tempValues.splice(valueIndex, 1); // Remove value
        console.log('Removed value from temp selection:', value);
    } else {
        tempValues.push(value); // Add value
        console.log('Added value to temp selection:', value);
    }

    // Update checkbox state immediately
    updateDropdownCheckboxes(columnIndex, columnName);

    // Update button appearance to show temp selection count
    updateFilterButtonAppearanceTemp(columnIndex, columnName);

    console.log('Updated checkbox and button appearance for:', {
        columnIndex,
        columnName,
        tempSelections: window.tempFilterSelections[columnName],
        dropdownElement: document.getElementById(`col-filter-options-${columnIndex}`)
    });
};

// Update dropdown options highlighting to match current (temp or applied) filter state
function updateDropdownCheckboxes(columnIndex, columnName) {
    const optionsContainer = document.getElementById(`col-filter-options-${columnIndex}`);
    if (!optionsContainer) {
        console.log(`[CHECK-ERROR] ${columnName} container not found`);
        return;
    }

    console.log(`[CHECK-START] ${columnName}`);

    // Use temporary selections if they exist, otherwise use applied selections
    let selectedValues = [];
    if (window.tempFilterSelections[columnName]) {
        selectedValues = window.tempFilterSelections[columnName];
    } else {
        const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
        const filter = columnFilters[columnName] || { values: [] };
        selectedValues = filter.values || [];
    }

    const selectedValuesSet = new Set(selectedValues);
    const options = optionsContainer.querySelectorAll('.column-filter-option');
    console.log(`[CHECK-DATA] ${columnName} options=${options.length} selected=${selectedValues.length}`);

    options.forEach((option, index) => {
        // Handle checkbox-style options
        const checkbox = option.querySelector('input[type="checkbox"]');
        const textSpan = option.querySelector('span.flex-1');

        // Handle text-only options with .option-text class
        const optionText = option.querySelector('.option-text');

        if (checkbox && textSpan) {
            // Checkbox-style option
            const optionValue = option.getAttribute('data-value') ||
                               option.getAttribute('title') ||
                               textSpan.textContent;

            if (selectedValuesSet.has(optionValue)) {
                option.classList.add('selected');
                checkbox.checked = true;
                checkbox.setAttribute('checked', 'checked');
                console.log(`[CHECK-SET] ${columnName} ${optionValue}=true`);
            } else {
                option.classList.remove('selected');
                checkbox.checked = false;
                checkbox.removeAttribute('checked');
                console.log(`[CHECK-SET] ${columnName} ${optionValue}=false`);
            }
        } else if (optionText) {
            // Text-only option with .option-text class
            const optionValue = option.getAttribute('title') || optionText.textContent;
            console.log(`Text option ${index}: value="${optionValue}", selected=${selectedValuesSet.has(optionValue)}`);

            if (selectedValuesSet.has(optionValue)) {
                option.classList.add('selected');
                // Update selection indicator
                const indicator = option.querySelector('.selection-indicator');
                if (indicator) {
                    indicator.textContent = '✓';
                }
            } else {
                option.classList.remove('selected');
                // Update selection indicator
                const indicator = option.querySelector('.selection-indicator');
                if (indicator) {
                    indicator.textContent = '';
                }
            }
        } else {
            console.log(`Option ${index} has no recognizable elements`);
        }
    });
}

// Update filter button appearance based on temporary selections
function updateFilterButtonAppearanceTemp(columnIndex, columnName) {
    const button = document.getElementById(`col-filter-btn-${columnIndex}`);
    const iconSpan = document.getElementById(`col-filter-icon-${columnIndex}`);

    // Check if elements exist before trying to modify them
    if (!button) {
        console.warn(`Filter button not found: col-filter-btn-${columnIndex}`);
        return;
    }

    // Use temporary selections to show count
    const tempValues = window.tempFilterSelections[columnName] || [];
    const filterCount = tempValues.length;

    if (filterCount > 0) {
        button.className = 'btn btn-danger btn-sm';
        if (iconSpan) {
            iconSpan.textContent = `${filterCount} x`;
        }
    } else {
        // Check if there are applied filters when no temp selections
        const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
        const appliedFilter = columnFilters[columnName] || { values: [] };
        const appliedCount = appliedFilter.values ? appliedFilter.values.length : 0;

        if (appliedCount > 0) {
            button.className = 'btn btn-danger btn-sm';
            if (iconSpan) {
                iconSpan.textContent = `${appliedCount} x`;
            }
        } else {
            button.className = 'btn btn-outline-primary btn-sm';
            if (iconSpan) {
                iconSpan.textContent = 'v';
            }
        }
    }

    console.log('Updated temp button appearance:', { columnName, filterCount });
}

// Update filter button appearance based on active filters
function updateFilterButtonAppearance(columnIndex, columnName) {
    const button = document.getElementById(`col-filter-btn-${columnIndex}`);
    const iconSpan = document.getElementById(`col-filter-icon-${columnIndex}`);

    // Check if elements exist before trying to modify them
    if (!button) {
        console.warn(`Filter button not found: col-filter-btn-${columnIndex}`);
        return;
    }

    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
    const filter = columnFilters[columnName] || { values: [] };

    const filterCount = filter.values ? filter.values.length : 0;

    if (filterCount > 0) {
        button.className = 'btn btn-danger btn-sm';
        if (iconSpan) {
            iconSpan.textContent = `${filterCount} x`;
        }
    } else {
        button.className = 'btn btn-outline-primary btn-sm';
        if (iconSpan) {
            iconSpan.textContent = 'v';
        }
    }

    console.log('Updated button appearance:', { columnName, filterCount });
}

// Clear filter for a specific column (keeps dropdown open)
window.clearColumnFilter = function(columnIndex, columnName) {
    event.stopPropagation();

    console.log(`[CLEAR] ${columnName}`);

    // Clear temporary selections
    if (window.tempFilterSelections[columnName]) {
        window.tempFilterSelections[columnName] = [];
    }

    // Clear applied filters from session storage
    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
    delete columnFilters[columnName];
    sessionStorage.setItem(STORAGE_KEYS.COLUMN_FILTERS, JSON.stringify(columnFilters));

    // Apply filters to update the table data first
    applyAllFilters();

    // Generate options from data with all filters EXCEPT the current column
    // This will create completely new HTML elements
    generateUniqueValueOptionsExcludingColumn(columnIndex, columnName, true);

    // Update button appearance and placeholder to show cleared state
    updateFilterButtonAppearanceTemp(columnIndex, columnName);
    updateFilterHeaderControls(columnIndex, columnName);

    // Ensure dropdown stays visible after clearing
    const dropdownElement = document.getElementById(`col-filter-dropdown-${columnIndex}`);
    if (dropdownElement) {
        dropdownElement.classList.add('show');
    }
};

// Apply filter for a specific column (closes dropdown)
window.applyColumnFilter = function(columnIndex, columnName) {
    event.stopPropagation();

    console.log('Applying filter for:', { columnIndex, columnName });

    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');

    // Use temporary selections if they exist, otherwise keep current filter
    if (window.tempFilterSelections[columnName]) {
        columnFilters[columnName] = {
            search: '',
            values: [...window.tempFilterSelections[columnName]]
        };

        // Save to session storage
        sessionStorage.setItem(STORAGE_KEYS.COLUMN_FILTERS, JSON.stringify(columnFilters));

        // Clear temporary selections
        delete window.tempFilterSelections[columnName];
    }

    console.log('Applied filter:', { columnName, filter: columnFilters[columnName] });

    // Apply filters and update table
    applyAllFilters();

    // Update button appearance and placeholder to show applied filter count
    updateFilterButtonAppearance(columnIndex, columnName);
    updateFilterHeaderControls(columnIndex, columnName);

    // Close dropdown
    const dropdown = document.getElementById(`col-filter-dropdown-${columnIndex}`);
    if (dropdown) {
        dropdown.classList.remove('show');
    }

    console.log('Applied and closed dropdown for column:', columnName);
};

// Toggle column filter dropdown
function toggleColumnFilter(columnIndex, columnName, event) {
    event.stopPropagation();

    const button = document.getElementById(`col-filter-btn-${columnIndex}`);
    const dropdown = document.getElementById(`col-filter-dropdown-${columnIndex}`);
    const allDropdowns = document.querySelectorAll('.column-filter-dropdown');

    // Close all other dropdowns
    allDropdowns.forEach(d => {
        if (d !== dropdown) d.classList.remove('show');
    });

    // Toggle current dropdown and store state
    const willBeOpen = !dropdown.classList.contains('show');
    if (willBeOpen) {
        openDropdownColumn = columnIndex;

        // Calculate position for the dropdown
        const buttonRect = button.getBoundingClientRect();
        dropdown.style.top = `${buttonRect.bottom + window.scrollY + 2}px`;
        dropdown.style.left = `${buttonRect.left + window.scrollX}px`;
        dropdown.style.width = `${Math.max(220, Math.min(350, buttonRect.width))}px`;

        dropdown.classList.add('show');

        // Show loading state immediately
        const optionsContainer = document.getElementById(`col-filter-options-${columnIndex}`);
        if (optionsContainer) {
            optionsContainer.innerHTML = `
                <div class="dropdown-loading">
                    <div class="dropdown-loading-spinner"></div>
                    <div>Loading unique values...</div>
                </div>
            `;
        }

        // Extract unique values asynchronously if not already done
        if (!allUniqueValues.has(columnName)) {
            // Use setTimeout to make it non-blocking
            setTimeout(() => {
                const uniqueValues = extractUniqueValues(columnName);
                allUniqueValues.set(columnName, uniqueValues);

                // Update the filter options
                if (optionsContainer) {
                    optionsContainer.innerHTML = generateFilterOptions(columnName, uniqueValues);
                }
            }, 0);
        } else {
            // Values already exist, show them immediately
            const uniqueValues = getUniqueValuesFromCache(columnName);
            if (optionsContainer) {
                optionsContainer.innerHTML = generateFilterOptions(columnName, uniqueValues);
            }
        }

        // Close dropdown when clicking outside
        setTimeout(() => {
            const closeHandler = function(e) {
                if (!dropdown.contains(e.target) && !button.contains(e.target)) {
                    dropdown.classList.remove('show');
                    openDropdownColumn = null;
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    } else {
        openDropdownColumn = null;
        dropdown.classList.remove('show');
    }
}

// Toggle individual filter value
function toggleFilterValue(columnName, value, event) {
    event.stopPropagation();

    const filter = columnFilters.get(columnName) || { search: '', values: new Set() };

    if (filter.values.has(value)) {
        filter.values.delete(value);
    } else {
        filter.values.add(value);
    }

    columnFilters.set(columnName, filter);

    // Update the UI
    event.target.closest('.column-filter-option').classList.toggle('selected');
    const checkbox = event.target.closest('.column-filter-option').querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = filter.values.has(value);

    // Update filter count
    const columnIndex = currentColumns.indexOf(columnName) + 1;
    const countElement = document.getElementById(`col-filter-count-${columnIndex}`);
    const buttonElement = document.getElementById(`col-filter-btn-${columnIndex}`);

    if (countElement && buttonElement) {
        const count = filter.values.size;
        countElement.textContent = count > 0 ? count : '';
        buttonElement.classList.toggle('active', count > 0);
    }

    applyAllFilters();
}

// Select all filter values for a column
function selectAllFilterValues(columnName) {
    const uniqueValues = getUniqueValuesFromCache(columnName) || [];
    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
    const filter = columnFilters[columnName] || { search: '', values: [] };

    // Set all unique values as selected
    filter.values = [...uniqueValues];
    filter.search = ''; // Clear search when using value filters
    columnFilters[columnName] = filter;

    // Save to session storage
    sessionStorage.setItem(STORAGE_KEYS.COLUMN_FILTERS, JSON.stringify(columnFilters));

    // Update UI
    const columnIndex = currentColumns.indexOf(columnName) + 1;
    const optionsContainer = document.getElementById(`col-filter-options-${columnIndex}`);
    if (optionsContainer) {
        optionsContainer.querySelectorAll('.column-filter-option').forEach(option => {
            option.classList.add('selected');
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = true;
        });
    }

    // Update filter count
    const countElement = document.getElementById(`col-filter-count-${columnIndex}`);
    const buttonElement = document.getElementById(`col-filter-btn-${columnIndex}`);
    if (countElement && buttonElement) {
        countElement.textContent = uniqueValues.length;
        buttonElement.classList.add('active');
    }

    console.log('Selected all values:', { columnName, count: uniqueValues.length });

    applyAllFilters();
}

// Deselect all filter values for a column
function deselectAllFilterValues(columnName) {
    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');
    const filter = columnFilters[columnName] || { search: '', values: [] };

    // Clear all selected values
    filter.values = [];
    filter.search = ''; // Clear search when using value filters
    columnFilters[columnName] = filter;

    // Save to session storage
    sessionStorage.setItem(STORAGE_KEYS.COLUMN_FILTERS, JSON.stringify(columnFilters));

    // Update UI
    const columnIndex = currentColumns.indexOf(columnName) + 1;
    const optionsContainer = document.getElementById(`col-filter-options-${columnIndex}`);
    if (optionsContainer) {
        optionsContainer.querySelectorAll('.column-filter-option').forEach(option => {
            option.classList.remove('selected');
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
        });
    }

    // Update filter count
    const countElement = document.getElementById(`col-filter-count-${columnIndex}`);
    const buttonElement = document.getElementById(`col-filter-btn-${columnIndex}`);
    if (countElement && buttonElement) {
        countElement.textContent = '';
        buttonElement.classList.remove('active');
    }

    console.log('Deselected all values:', { columnName });

    applyAllFilters();
}

// Apply all column filters and searches
function applyAllFilters() {
    if (!currentRows || currentRows.length === 0) {
        filteredData = [];
        updatePagination();
        scheduleTableRender();
        return;
    }

    // Get filters from session storage
    const columnFilters = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_FILTERS) || '{}');

    filteredData = currentRows.filter(row => {
        // Check each column filter - OR logic across different columns
        for (const [columnName, filter] of Object.entries(columnFilters)) {
            const cellValue = row[columnName];
            const cellString = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';

            // Apply search filter
            if (filter.search) {
                let matches = false;
                try {
                    const regex = new RegExp(filter.search, 'i');
                    matches = regex.test(cellString);
                } catch (e) {
                    // Fallback to literal search if regex is invalid
                    matches = cellString.toLowerCase().includes(filter.search.toLowerCase());
                }

                if (!matches) return false;
            }

            // Apply value filter - OR logic for multiple selected values
            if (filter.values && filter.values.length > 0) {
                // Check if cell value matches any of the selected values (OR logic)
                const hasMatchingValue = filter.values.some(selectedValue => selectedValue === cellString);
                if (!hasMatchingValue) return false;
            }
        }

        return true;
    });

    console.log('Filtered data:', {
        originalCount: currentRows.length,
        filteredCount: filteredData.length,
        activeFilters: Object.keys(columnFilters).length
    });

    // Reset to first page and re-render
    currentPage = 1;
    updatePagination();
    scheduleTableRender();
}

// Clear all column filters
function clearAllColumnFilters() {
    columnFilters.clear();
    allUniqueValues.clear();
    filteredData = [...currentRows];
    updatePagination();
    scheduleTableRender();
}

// Make additional functions globally available
window.selectColumn = selectColumn;
window.goToPage = goToPage;
window.changePageSize = changePageSize;
window.toggleColumnFilter = toggleColumnFilter;
window.filterByColumn = filterByColumn;
window.toggleFilterValue = toggleFilterValue;
window.selectAllFilterValues = selectAllFilterValues;
window.deselectAllFilterValues = deselectAllFilterValues;