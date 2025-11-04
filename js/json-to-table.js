/**
 * JSON to Table Converter Module
 * Handles JSON input, parsing, flattening, and table generation
 */

// Global state for this module
let currentData = null;
let currentRows = [];
let currentColumns = [];
let sortColumn = null;
let sortDirection = 'asc'; // 'asc' or 'desc'
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
    COLUMN_FILTERS: 'almightycoon_column_filters'
};

// Virtual scrolling state
let virtualScrollingEnabled = false;
let virtualScrollContainer = null;
let virtualRowHeight = 35; // pixels
let virtualVisibleRows = 0;
let virtualScrollPosition = 0;

// Initialize the JSON to Table module
function initJsonToTable() {
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
    searchInput.addEventListener('input', handleColumnSearch);

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
                if (selectedColumnIndex >= 0 && filteredColumns[selectedColumnIndex]) {
                    goToColumn(filteredColumns[selectedColumnIndex]);
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
        handleColumnSearch({ target: searchInput });
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#columnSearch') && !e.target.closest('#columnSuggestions')) {
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
    hideColumnDropdown();

    const searchInput = document.getElementById('columnSearch');
    if (searchInput) {
        searchInput.value = columnName;
    }

    // Find the column index in the table
    const table = document.querySelector('table');
    if (!table) {
        console.warn('No table found for column navigation');
        return;
    }

    const headers = table.querySelectorAll('th');
    let columnIndex = -1;

    headers.forEach((header, index) => {
        // Look for the column name in the header chip
        const headerChip = header.querySelector('.header-chip');
        const headerText = headerChip ? headerChip.textContent.trim() : header.textContent.trim();

        if (headerText === columnName) {
            columnIndex = index;
        }
    });

    if (columnIndex === -1) {
        console.warn(`Column "${columnName}" not found in table`);
        window.AllmightyUtils.showError(`Column "${columnName}" not found`);
        return;
    }

    // Scroll to the column with smooth animation
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) {
        const header = headers[columnIndex];
        if (header) {
            const headerLeft = header.offsetLeft;
            const containerWidth = tableContainer.clientWidth;
            const headerWidth = header.offsetWidth;
            const scrollTarget = headerLeft - (containerWidth / 2) + (headerWidth / 2);

            tableContainer.scrollTo({
                left: Math.max(0, scrollTarget),
                behavior: 'smooth'
            });
        }
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

// Get column nesting level
function getColumnLevel(columnName) {
    return (columnName.match(/\./g) || []).length;
}

// Highlight a column temporarily
function highlightColumn(columnIndex) {
    const table = document.querySelector('table');
    if (!table) return;

    const rows = table.querySelectorAll('tr');
    rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td, th');
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

    if (!dataToUse.length) {
        hidePagination();
        return;
    }

    totalPages = Math.ceil(dataToUse.length / pageSize);
    currentPage = Math.min(currentPage, totalPages);

    // Calculate pagination bounds
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, dataToUse.length);

    // Get paginated rows
    paginatedRows = dataToUse.slice(startIndex, endIndex);

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
    sortDirection = 'asc';
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

// Generate paginated table HTML
function generatePaginatedTableHTML(rows, columns) {
    // Get actual row numbers (considering pagination)
    const startRowNum = (currentPage - 1) * pageSize + 1;

    let html = '<table><thead><tr><th style="min-width: 60px; max-width: 60px;">#</th>';
    columns.forEach((col, index) => {
        const hierarchyClass = getColumnHierarchyClass(col);
        const isArrayIndex = col.match(/\[\d+\]$/);
        const arrayClass = isArrayIndex ? ' array-index' : '';
        const sortIndicator = sortColumn === col ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';
        const columnIndex = index + 1; // +1 because column 0 is the row number

        const uniqueValues = allUniqueValues.get(col) || [];
        const filterCount = (columnFilters.get(col)?.values?.size || 0);
        const hasActiveFilter = filterCount > 0;

        html += `
        <th class="${hierarchyClass}${arrayClass}" style="min-width: 200px; max-width: 300px;">
            <div class="column-controls">
                <div style="display: flex; gap: 4px; align-items: center; margin-bottom: 4px;">
                    <input type="text"
                           class="column-search-box"
                           style="flex: 1; min-width: 0;"
                           id="col-search-${columnIndex}"
                           placeholder="Search (regex)..."
                           onkeyup="filterByColumn(${columnIndex}, '${window.AllmightyUtils.escapeHtml(col)}', this.value)"
                           onfocus="setColumnSearchFocus(${columnIndex})"
                           onblur="setColumnSearchBlur(${columnIndex})"
                           onclick="event.stopPropagation()">
                    <button class="column-filter-button ${hasActiveFilter ? 'active' : ''}"
                            id="col-filter-btn-${columnIndex}"
                            onclick="toggleColumnFilter(${columnIndex}, '${window.AllmightyUtils.escapeHtml(col)}', event)"
                            style="flex-shrink: 0; padding: 4px 6px;">
                        <span>v</span>
                        <span id="col-filter-count-${columnIndex}">${filterCount > 0 ? filterCount : ''}</span>
                    </button>
                </div>
                <div class="column-filter-dropdown" id="col-filter-dropdown-${columnIndex}">
                    <div class="filter-controls">
                        <button class="filter-control-button" onclick="selectAllFilterValues('${window.AllmightyUtils.escapeHtml(col)}')">All</button>
                        <button class="filter-control-button" onclick="deselectAllFilterValues('${window.AllmightyUtils.escapeHtml(col)}')">None</button>
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
        }, 50); // Increased delay to ensure DOM is fully ready after sorting
    });
}

// Generate only the table body HTML (no headers)
function generateTableBody() {
    if (!paginatedRows.length) return '<tbody></tbody>';

    // Get actual row numbers (considering pagination)
    const startRowNum = (currentPage - 1) * pageSize + 1;

    let html = '<tbody>';
    paginatedRows.forEach((row, index) => {
        const rowNum = startRowNum + index;
        html += `<tr><td><strong>${rowNum}</strong></td>`;

        currentColumns.forEach(col => {
            const cellValue = row[col] || '';
            const displayValue = window.AllmightyUtils.escapeHtml(window.AllmightyUtils.formatValue(cellValue));

            // Handle cell expansion for long content
            if (typeof cellValue === 'string' && cellValue.length > 200) {
                const cellId = `cell-${rowNum}-${currentColumns.indexOf(col)}`;
                const isExpanded = expandedCells.has(cellId);
                const shortValue = displayValue.substring(0, 200) + '...';
                const fullValue = displayValue;

                html += `<td>
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
                html += `<td>${displayValue}</td>`;
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
    updatePagination();

    // Update only the table body, preserving headers with search inputs
    requestAnimationFrame(() => {
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            const table = tableContainer.querySelector('table');
            if (table) {
                const tbody = table.querySelector('tbody');
                if (tbody) {
                    // Generate new tbody content
                    const newTbodyHtml = generateTableBody();
                    tbody.innerHTML = newTbodyHtml;
                    console.log('Background table body update completed');
                }
            }
        }
    });
}

// Render paginated table with performance optimizations
function renderPaginatedTable() {
    if (!paginatedRows.length || !currentColumns.length) return;

    // For very large datasets, use progressive rendering
    if (paginatedRows.length > 500) {
        renderProgressiveTable();
        return;
    }

    // Show loading state for large datasets
    if (currentRows.length > 1000) {
        showLoadingState();
    }

    try {
        const tableContainer = document.getElementById('tableContainer');
        if (!tableContainer) return;

        // Use DocumentFragment for faster DOM manipulation
        const fragment = document.createDocumentFragment();
        const tableElement = document.createElement('table');
        tableElement.innerHTML = generatePaginatedTableHTML(paginatedRows, currentColumns);
        fragment.appendChild(tableElement);

        // Clear and append in one operation
        tableContainer.innerHTML = '';
        tableContainer.appendChild(fragment);

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
        const sortIndicator = sortColumn === col ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

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
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666;">
                <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px;"></div>
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
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
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
        <h3 style="margin: 0 0 15px 0; color: #2c3e50;">🔍 Explore JSON Paths</h3>
        <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">Select a path to extract specific data, or use full JSON:</p>
        <div style="margin-bottom: 15px;">
            <select id="pathSelect" size="8" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;">
                <option value="">📄 Use full JSON (no path)</option>
                ${paths.map(path => `<option value="${path}">📂 ${path}</option>`).join('')}
            </select>
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="cancelPathSelection()" style="padding: 8px 16px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button onclick="selectPathAndClose()" style="padding: 8px 16px; border: none; background: #4facfe; color: white; border-radius: 4px; cursor: pointer;">Select & Close</button>
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
            displayName = col.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
        }

        // Show column hierarchy with indentation
        const level = getColumnLevel(col);
        const indentClass = level > 0 ? `suggestion-level-${Math.min(level, 4)}` : '';

        return `
            <div class="suggestion-item ${indentClass} hover:bg-gray-50 cursor-pointer"
                 onclick="goToColumn('${col}')"
                 role="option">
                <div class="flex items-center gap-2 p-2.5">
                    <span class="column-name flex-1">${displayName}</span>
                    <span class="text-xs text-gray-400">Col ${index + 1}</span>
                </div>
            </div>
        `;
    }).join('');

    suggestions.innerHTML = htmlContent;
    suggestions.classList.remove('hidden');
    suggestions.classList.add('show');
}

// Show message when no columns are available
function showNoColumnsMessage() {
    const suggestions = document.getElementById('columnSuggestions');
    if (!suggestions) return;

    suggestions.innerHTML = `
        <div class="suggestion-item p-4 text-gray-500 text-center">
            <div class="flex items-center gap-2 justify-center">
                <span>📊</span>
                <span>No columns available</span>
            </div>
            <div class="text-xs text-gray-400 mt-2">
                Convert JSON data first to see columns
            </div>
        </div>
    `;

    suggestions.classList.remove('hidden');
    suggestions.classList.add('show');
}

// Show message when no search results found
function showNoResultsMessage(searchTerm) {
    const suggestions = document.getElementById('columnSuggestions');
    if (!suggestions) return;

    suggestions.innerHTML = `
        <div class="suggestion-item p-4 text-gray-500 text-center">
            <div class="flex items-center gap-2 justify-center">
                <span>🔍</span>
                <span>No columns found for "${searchTerm}"</span>
            </div>
            <div class="text-xs text-gray-400 mt-2">
                Try a different search term
            </div>
        </div>
    `;

    suggestions.classList.remove('hidden');
    suggestions.classList.add('show');
}

// Get column nesting level for indentation
function getColumnLevel(columnName) {
    return (columnName.match(/\./g) || []).length;
}

// Go to column with enhanced navigation
window.goToColumn = function(columnName) {
    hideColumnDropdown();

    const searchInput = document.getElementById('columnSearch');
    if (searchInput) {
        searchInput.value = columnName;
    }

    // Find the column index in the table
    const table = document.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('th');
    let columnIndex = -1;

    headers.forEach((header, index) => {
        const headerChip = header.querySelector('.header-chip');
        const headerText = headerChip ? headerChip.textContent.trim() : header.textContent.trim();

        if (headerText === columnName) {
            columnIndex = index;
        }
    });

    if (columnIndex === -1) return;

    // Scroll to the column with smooth animation
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) {
        const header = headers[columnIndex];
        if (header) {
            const headerLeft = header.offsetLeft;
            const containerWidth = tableContainer.clientWidth;
            const headerWidth = header.offsetWidth;
            const scrollTarget = headerLeft - (containerWidth / 2) + (headerWidth / 2);

            tableContainer.scrollTo({
                left: Math.max(0, scrollTarget),
                behavior: 'smooth'
            });
        }
    }

    // Highlight the column temporarily
    highlightColumn(columnIndex);

    // Show success message
    window.AllmightyUtils.showSuccess(`🎯 Jumped to column "${columnName}" (${columnIndex + 1})`);
    setTimeout(() => {
        window.AllmightyUtils.clearAllToasts();
    }, 3000);
};

// Hide column dropdown
function hideColumnDropdown() {
    const suggestions = document.getElementById('columnSuggestions');
    if (suggestions) {
        suggestions.classList.remove('show');
        suggestions.classList.add('hidden');
    }
}

// Hide dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#columnSearch') && !e.target.closest('#columnSuggestions')) {
        hideColumnDropdown();
    }
});

// Make functions globally available
window.showPathExplorer = showPathExplorer;
window.extractJsonPath = extractJsonPath;
window.searchAndGoToColumn = searchAndGoToColumn;
window.goToColumn = goToColumn;

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

        // Clear session storage search state
        try {
            sessionStorage.removeItem(STORAGE_KEYS.COLUMN_SEARCH);
        } catch (e) {
            console.error('Failed to clear search state from session storage:', e);
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
function generateTable(data, sortColumn = null, sortDirection = 'asc') {
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
    let html = '<table><thead><tr><th>#</th>';
    currentColumns.forEach(col => {
        const hierarchyClass = getColumnHierarchyClass(col);
        const isArrayIndex = col.match(/\[\d+\]$/);
        const arrayClass = isArrayIndex ? ' array-index' : '';
        const sortIndicator = sortColumn === col ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

        html += `<th class="${hierarchyClass}${arrayClass}" onclick="toggleColumnSort('${col}')" title="Click to sort by ${window.AllmightyUtils.escapeHtml(col)}"><div class="header-chip">${window.AllmightyUtils.escapeHtml(col)}<span class="sort-indicator">${sortIndicator}</span></div></th>`;
    });
    html += '</tr></thead><tbody>';

    rows.forEach((row, index) => {
        html += `<tr><td><strong>${index + 1}</strong></td>`;
        currentColumns.forEach(col => {
            const cellValue = row[col] || '';
            html += `<td>${window.AllmightyUtils.escapeHtml(window.AllmightyUtils.formatValue(cellValue))}</td>`;
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
    if (sortColumn === column) {
        // Toggle direction if same column
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to ascending
        sortColumn = column;
        sortDirection = 'asc';
    }

    // Re-sort current rows instead of regenerating from scratch
    if (currentRows.length > 0) {
        console.log(`Sorting column "${column}" in direction "${sortDirection}"`);
        currentRows = sortRows(currentRows, sortColumn, sortDirection);

        // Apply filters and update pagination
        applyAllFilters();

        // Use scheduleTableRender to ensure search inputs are restored
        console.log('Calling scheduleTableRender after sorting');
        scheduleTableRender();
    }

    // Log sorting action
    if (window.AllmightyConversion && window.AllmightyConversion.config && window.AllmightyConversion.config.debug) {
        console.log(`Sorting by ${column} (${sortDirection})`);
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
    const filter = columnFilters.get(columnName);
    const selectedValues = filter?.values || new Set();

    return values.map(value => {
        const escapedValue = window.AllmightyUtils.escapeHtml(value);
        const isChecked = selectedValues.has(value);
        const shortValue = escapedValue.length > 50 ? escapedValue.substring(0, 47) + '...' : escapedValue;

        return `
            <div class="column-filter-option ${isChecked ? 'selected' : ''}"
                 onclick="toggleFilterValue('${window.AllmightyUtils.escapeHtml(columnName)}', '${escapedValue.replace(/'/g, "\\'")}', event)">
                <input type="checkbox"
                       ${isChecked ? 'checked' : ''}
                       onclick="event.stopPropagation()">
                <span title="${escapedValue}">${shortValue}</span>
            </div>
        `;
    }).join('');
}

// Handle column header search filtering functionality
window.filterByColumn = function(columnIndex, columnName, searchValue) {
    // Clear existing timeout for this column
    if (searchTimeouts.has(columnIndex)) {
        clearTimeout(searchTimeouts.get(columnIndex));
    }

    // Mark search as dirty to trigger render when input loses focus
    isSearchDirty = true;

    // Debounced save to session storage and trigger filtering
    const timeoutId = setTimeout(() => {
        try {
            // Get current search state from session storage
            const searchState = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.COLUMN_SEARCH) || '{}');

            // Update the specific column search
            searchState[columnName] = searchValue;

            // Save back to session storage
            sessionStorage.setItem(STORAGE_KEYS.COLUMN_SEARCH, JSON.stringify(searchState));

            // Trigger filtering if no input is currently focused
            if (focusedColumnInput === null) {
                applySearchFromStorage();
            }
        } catch (e) {
            console.error('Failed to save search state to session storage:', e);
        }
    }, 100); // 100ms debounce for saving

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
            performTableRender();
            isSearchDirty = false;
        }
    }, 200); // Short delay to allow for any debounced search to complete
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
            updatePagination();

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

    filteredData = currentRows.filter(row => {
        // Check each column filter
        for (const [columnName, filter] of columnFilters.entries()) {
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

            // Apply value filter
            if (filter.values.size > 0) {
                if (!filter.values.has(cellString)) return false;
            }
        }

        return true;
    });

    // Reset to first page
    currentPage = 1;
}

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
            const uniqueValues = allUniqueValues.get(columnName);
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
    const uniqueValues = allUniqueValues.get(columnName) || [];
    const filter = columnFilters.get(columnName) || { search: '', values: new Set() };

    uniqueValues.forEach(value => filter.values.add(value));
    columnFilters.set(columnName, filter);

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

    applyAllFilters();
}

// Deselect all filter values for a column
function deselectAllFilterValues(columnName) {
    const filter = columnFilters.get(columnName) || { search: '', values: new Set() };
    filter.values.clear();
    columnFilters.set(columnName, filter);

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

    filteredData = currentRows.filter(row => {
        // Check each column filter
        for (const [columnName, filter] of columnFilters.entries()) {
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

            // Apply value filter
            if (filter.values.size > 0) {
                if (!filter.values.has(cellString)) return false;
            }
        }

        return true;
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