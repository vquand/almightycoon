/**
 * Main Application Entry Point
 * Almightycoon - Data Transformation Tool
 */

// Application state and configuration
const AppConfig = {
    name: 'Almightycoon',
    version: '1.0.0',
    debug: false  // Production mode
};

// Available modules
const Modules = {
    'json-to-table': {
        name: 'JSON to Table',
        init: () => window.JsonToTable?.init(),
        required: true
    },
    'table-to-json': {
        name: 'Table to JSON',
        init: () => {
            console.log('Table to JSON module - Coming soon!');
            // Future implementation
        },
        required: false
    },
    'csv-converter': {
        name: 'CSV Converter',
        init: () => {
            console.log('CSV Converter module - Coming soon!');
            // Future implementation
        },
        required: false
    },
    'xml-converter': {
        name: 'XML Converter',
        init: () => {
            console.log('XML Converter module - Coming soon!');
            // Future implementation
        },
        required: false
    }
};

// Initialize the application
function initApp() {
    log('Initializing Almightycoon application...');

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeModules);
    } else {
        initializeModules();
    }
}

// Initialize all available modules
function initializeModules() {
    log('DOM ready, initializing modules...');

    // Initialize core utilities (already loaded via global scope)
    if (!window.AllmightyUtils) {
        console.error('Core utilities not loaded!');
        return;
    }

    // Initialize each module
    let initializedModules = [];
    let failedModules = [];

    Object.entries(Modules).forEach(([moduleId, moduleConfig]) => {
        try {
            log(`Initializing module: ${moduleConfig.name}`);

            if (typeof moduleConfig.init === 'function') {
                moduleConfig.init();
                initializedModules.push(moduleConfig.name);
                log(`✅ ${moduleConfig.name} initialized successfully`);
            } else {
                throw new Error(`Module ${moduleId} has no init function`);
            }
        } catch (error) {
            failedModules.push({ name: moduleConfig.name, error: error.message });
            console.error(`❌ Failed to initialize ${moduleConfig.name}:`, error);
        }
    });

    // Report initialization status
    if (initializedModules.length > 0) {
        log(`🚀 Application ready! Initialized modules: ${initializedModules.join(', ')}`);

        // Show welcome message or initial state
        showWelcomeMessage();
    }

    if (failedModules.length > 0) {
        log(`⚠️ Some modules failed to initialize: ${failedModules.map(m => m.name).join(', ')}`);

        // Show error message for required modules that failed
        const requiredFailures = failedModules.filter(m => Modules[Object.keys(Modules).find(key => Modules[key].name === m.name)]?.required);
        if (requiredFailures.length > 0) {
            window.AllmightyUtils.showError('Some required features are unavailable. Please refresh the page.');
        }
    }

    // Set up global error handling
    setupErrorHandling();
}

// Show welcome message
function showWelcomeMessage() {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'json-to-table') {
        // Add placeholder text if textarea exists and is empty
        const jsonInput = document.getElementById('jsonInput');
        if (jsonInput && !jsonInput.value) {
            jsonInput.placeholder = `Welcome to ${AppConfig.name}!

Paste your JSON data here or load a file to get started.

Example (single object):
{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "address": {
    "street": "123 Main St",
    "city": "New York"
  }
}

Example (array of objects):
[
  {
    "name": "John Doe",
    "age": 30,
    "skills": ["JavaScript", "Python"]
  },
  {
    "name": "Jane Smith",
    "age": 25,
    "skills": ["React", "Node.js"]
  }
]

Features:
✅ Complete flattening of nested objects
✅ Array flattening with index notation
✅ JSON string parsing and flattening
✅ CSV export functionality
✅ No internet connection required`;
        }
    }
}

// Set up global error handling
function setupErrorHandling() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        window.AllmightyUtils.showError('An unexpected error occurred. Please try again.');
    });

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
        console.error('Uncaught error:', event.error);
        if (AppConfig.debug) {
            window.AllmightyUtils.showError(`Error: ${event.error.message}`);
        }
    });
}

// Logging utility
function log(message, level = 'info') {
    if (AppConfig.debug || level === 'error') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${AppConfig.name} ${timestamp}]`;

        switch (level) {
            case 'error':
                console.error(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            default:
                console.log(prefix, message);
        }
    }
}

// Module registration system for future modules
function registerModule(moduleId, config) {
    if (Modules[moduleId]) {
        console.warn(`Module ${moduleId} is already registered`);
        return false;
    }

    Modules[moduleId] = {
        name: config.name || moduleId,
        init: config.init || (() => {}),
        required: config.required || false,
        ...config
    };

    log(`Module ${config.name || moduleId} registered`);
    return true;
}

// Module unregistration system
function unregisterModule(moduleId) {
    if (!Modules[moduleId]) {
        console.warn(`Module ${moduleId} is not registered`);
        return false;
    }

    const moduleName = Modules[moduleId].name;
    delete Modules[moduleId];
    log(`Module ${moduleName} unregistered`);
    return true;
}

// Public API
window.Almightycoon = {
    config: AppConfig,
    modules: Modules,
    registerModule,
    unregisterModule,
    log,
    init: initApp
};

// Auto-initialize the application
initApp();

// Resizable panels functionality
function initResizablePanels() {
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    const resizeDivider = document.getElementById('resizeDivider');
    const mainContainer = document.querySelector('.main-container');

    
    if (!leftPanel || !rightPanel || !resizeDivider || !mainContainer) {
        console.warn('Resizable panels: Required elements not found');
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;

    // Mouse down on divider
    resizeDivider.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startLeftWidth = leftPanel.offsetWidth;

        // Add visual feedback
        resizeDivider.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        e.preventDefault();
        e.stopPropagation();
    });

    // Mouse move
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const containerWidth = mainContainer.offsetWidth;
        const newLeftWidth = startLeftWidth + deltaX;

        // Calculate percentage
        const leftPercentage = (newLeftWidth / containerWidth) * 100;

        // Enforce min/max constraints (in pixels)
        const minLeftWidth = 300;
        const maxLeftWidth = containerWidth * 0.7;

        if (newLeftWidth >= minLeftWidth && newLeftWidth <= maxLeftWidth) {
            leftPanel.style.width = `${leftPercentage}%`;

            // Store the preference in localStorage
            localStorage.setItem('almightycoon-leftPanelWidth', `${leftPercentage}%`);
        }
    });

    // Mouse up
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizeDivider.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // Load saved width preference
    const savedWidth = localStorage.getItem('almightycoon-leftPanelWidth');
    if (savedWidth) {
        leftPanel.style.width = savedWidth;
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        // When window resizes, maintain the percentage width
        const currentWidth = leftPanel.style.width;
        if (currentWidth && currentWidth.includes('%')) {
            // Keep the current percentage
            leftPanel.style.width = currentWidth;
        }
    });

    // Touch support for mobile devices
    let touchStartX = 0;
    let touchStartLeftWidth = 0;

    resizeDivider.addEventListener('touchstart', (e) => {
        isResizing = true;
        touchStartX = e.touches[0].clientX;
        touchStartLeftWidth = leftPanel.offsetWidth;

        resizeDivider.classList.add('resizing');
        e.preventDefault();
    });

    document.addEventListener('touchmove', (e) => {
        if (!isResizing) return;

        const deltaX = e.touches[0].clientX - touchStartX;
        const containerWidth = mainContainer.offsetWidth;
        const newLeftWidth = touchStartLeftWidth + deltaX;

        const leftPercentage = (newLeftWidth / containerWidth) * 100;

        const minLeftWidth = 300;
        const maxLeftWidth = containerWidth * 0.7;

        if (newLeftWidth >= minLeftWidth && newLeftWidth <= maxLeftWidth) {
            leftPanel.style.width = `${leftPercentage}%`;
            localStorage.setItem('almightycoon-leftPanelWidth', `${leftPercentage}%`);
        }
    });

    document.addEventListener('touchend', () => {
        if (isResizing) {
            isResizing = false;
            resizeDivider.classList.remove('resizing');
        }
    });

    console.log('✅ Resizable panels initialized');
}

// Initialize resizable panels when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initResizablePanels);
} else {
    initResizablePanels();
}