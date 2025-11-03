/**
 * Core Utilities for AllmightyConversion
 * Common functions used across all conversion modules
 */

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format value for display
function formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

// Try to parse a string as JSON, return null if it fails
function tryParseJson(str) {
    try {
        // Check if string looks like JSON (starts with { or [)
        if (typeof str === 'string' && (str.trim().startsWith('{') || str.trim().startsWith('['))) {
            return JSON.parse(str);
        }
    } catch (e) {
        // Not valid JSON, return null
    }
    return null;
}

// Show error message
function showError(message, containerId = 'messageArea') {
    const messageArea = document.getElementById(containerId);
    if (messageArea) {
        messageArea.innerHTML = `<div class="error-message">❌ ${message}</div>`;
    }
}

// Show success message
function showSuccess(message, containerId = 'messageArea') {
    const messageArea = document.getElementById(containerId);
    if (messageArea) {
        messageArea.innerHTML = `<div class="success-message">✅ ${message}</div>`;
        messageArea.classList.add('show');
    }
}

// Show info message
function showInfo(message, containerId = 'messageArea') {
    const messageArea = document.getElementById(containerId);
    if (messageArea) {
        messageArea.innerHTML = `<div class="success-message">ℹ️ ${message}</div>`;
        messageArea.classList.add('show');
    }
}

// Clear all messages
function clearMessages(containerId = 'messageArea') {
    const messageArea = document.getElementById(containerId);
    if (messageArea) {
        messageArea.innerHTML = '';
        messageArea.classList.remove('show');
    }
}

// Tab switching functionality
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Add active class to clicked button
    event.target.classList.add('active');
}

// Escape CSV value
function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';

    const stringValue = String(value);

    // If value contains comma, newline, or quote, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }

    return stringValue;
}

// Download data as file
function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// Update statistics display
function updateStats(rowCount, colCount, nestedCount) {
    const rowCountElement = document.getElementById('rowCount');
    const colCountElement = document.getElementById('colCount');
    const nestedCountElement = document.getElementById('nestedCount');

    if (rowCountElement) rowCountElement.textContent = rowCount;
    if (colCountElement) colCountElement.textContent = colCount;
    if (nestedCountElement) nestedCountElement.textContent = nestedCount;

    // Show stats area if data exists
    const statsArea = document.getElementById('statsArea');
    if (statsArea && rowCount > 0) {
        statsArea.style.display = 'flex';
    }
}

// Show/hide export controls
function toggleExportControls(show = true) {
    const exportControls = document.getElementById('exportControls');
    if (exportControls) {
        exportControls.style.display = show ? 'flex' : 'none';
    }
}

// Clear all data and reset UI
function clearAll() {
    // Clear text areas
    const textAreas = document.querySelectorAll('textarea');
    textAreas.forEach(textarea => textarea.value = '');

    // Clear file info
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) fileInfo.innerHTML = '';

    // Clear tables
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) tableContainer.innerHTML = '';

    // Clear messages
    clearMessages();

    // Hide controls and stats
    toggleExportControls(false);

    const statsArea = document.getElementById('statsArea');
    if (statsArea) statsArea.style.display = 'none';

    // Clear file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => input.value = '');

    showSuccess('All data cleared!');
}

// Export functions for use in other modules
window.AllmightyUtils = {
    formatFileSize,
    escapeHtml,
    formatValue,
    tryParseJson,
    showError,
    showSuccess,
    showInfo,
    clearMessages,
    switchTab,
    escapeCsvValue,
    downloadFile,
    updateStats,
    toggleExportControls,
    clearAll
};