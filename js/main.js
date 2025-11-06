/**
 * Main Application Entry Point
 * Almightycoon - Data Transformation Tool
 */

// Application state and configuration
const AppConfig = {
    name: 'Almightycoon',
    version: '1.0.0',
    debug: true,  // Debug mode temporarily enabled
    currentModule: 'json-to-table'  // Track current module
};

// Available modules
const Modules = {
    'json-to-table': {
        name: 'JSON to Table',
        init: () => window.JsonToTable?.init(),
        required: true,
        showPanel: () => showJsonToTablePanel()
    },
    'table-to-json': {
        name: 'Table to JSON',
        init: () => {
            console.log('Table to JSON module - Coming soon!');
            // Future implementation
        },
        required: false,
        showPanel: () => showComingSoonPanel('Table to JSON')
    },
    'csv-converter': {
        name: 'CSV Converter',
        init: () => {
            console.log('CSV Converter module - Coming soon!');
            // Future implementation
        },
        required: false,
        showPanel: () => showComingSoonPanel('CSV Converter')
    },
    'xml-converter': {
        name: 'XML Converter',
        init: () => {
            console.log('XML Converter module - Coming soon!');
            // Future implementation
        },
        required: false,
        showPanel: () => showComingSoonPanel('XML Converter')
    },
    'timezone-converter': {
        name: 'Multi-Timezone Converter',
        init: () => {
            console.log('Opening timezone converter in separate page...');
            window.open('timezone-converter.html', '_blank');
        },
        required: false,
        showPanel: () => {
            console.log('Opening timezone converter in separate page...');
            window.open('timezone-converter.html', '_blank');
        }
    }
};

// Initialize the application
function initApp() {
    log('Initializing Almightycoon application...');

    // Set up URL routing first
    window.addEventListener('popstate', handleURLChange);

    // Set up converter type change listener
    setupConverterTypeListener();

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeModules);
    } else {
        initializeModules();
    }
}

// Setup converter type change listener
function setupConverterTypeListener() {
    // Handle button group clicks
    document.addEventListener('click', (e) => {
        // Check if clicked on a module button or its child
        const moduleButton = e.target.closest('[data-module]');
        if (moduleButton) {
            e.preventDefault();

            // Remove active class from all buttons
            document.querySelectorAll('[data-module]').forEach(btn => {
                btn.classList.remove('active');
            });

            // Add active class to clicked button
            moduleButton.classList.add('active');

            const selectedModule = moduleButton.dataset.module;
            const moduleName = moduleButton.textContent.trim();

            log(`Button clicked: ${selectedModule} - ${moduleName}`);

            // Switch to the module
            switchToModule(selectedModule);
        }
    });
}

// URL-based routing system
function updateURL(moduleId) {
    const url = new URL(window.location);
    url.searchParams.set('module', moduleId);
    window.history.pushState({ module: moduleId }, '', url);
    AppConfig.currentModule = moduleId;
}

function getModuleFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('module') || 'json-to-table';
}

function handleURLChange() {
    const moduleId = getModuleFromURL();
    if (moduleId !== AppConfig.currentModule) {
        switchToModule(moduleId);
    }
}

// Switch to a specific module
function switchToModule(moduleId) {
    log(`Switching to module: ${moduleId}`);

    const module = Modules[moduleId];
    if (!module) {
        log(`Module ${moduleId} not found`, 'error');
        return;
    }

    // Update current module and URL (skip if same module to avoid loops)
    if (AppConfig.currentModule !== moduleId) {
        AppConfig.currentModule = moduleId;
        updateURL(moduleId);
    }

    // Hide all converter modules first
    hideAllConverterModules();

    // Show the selected module's panel
    if (typeof module.showPanel === 'function') {
        module.showPanel();
    } else {
        log(`No showPanel function for module ${moduleId}`, 'warn');
        // Default: show coming soon
        showComingSoonPanel(module.name);
    }

    // Initialize the module if not already initialized
    // Only call init if we haven't initialized it before or if it's specifically needed
    if (typeof module.init === 'function') {
        try {
            // For now, always init to ensure modules work properly
            // This could be optimized to track initialization state
            module.init();
        } catch (error) {
            log(`Error initializing module ${moduleId}: ${error.message}`, 'error');
        }
    }
}

// Hide all converter modules
function hideAllConverterModules() {
    log('Hiding all converter modules');

    // Hide all modules with class 'converter-module'
    const modules = document.querySelectorAll('.converter-module');
    modules.forEach(module => {
        module.classList.add('d-none');
        module.style.display = 'none';
        module.style.visibility = 'hidden';
        module.style.opacity = '0';
    });

    // Hide the main content panels
    const mainContent = document.querySelector('main > .d-flex');
    const resizeDivider = document.getElementById('resizeDivider');
    const timezoneModule = document.getElementById('timezoneConverterModule');

    if (mainContent) {
        mainContent.classList.add('d-none');
        mainContent.style.display = 'none';
    }
    if (resizeDivider) {
        resizeDivider.classList.add('d-none');
        resizeDivider.style.display = 'none';
    }
    if (timezoneModule) {
        timezoneModule.classList.add('d-none');
        timezoneModule.style.display = 'none';
        timezoneModule.style.visibility = 'hidden';
        timezoneModule.style.opacity = '0';
    }

    // Hide any coming soon panel
    const comingSoonPanel = document.getElementById('comingSoonPanel');
    if (comingSoonPanel) {
        comingSoonPanel.classList.add('d-none');
        comingSoonPanel.style.display = 'none';
    }
}

// Show JSON to Table panel (default)
function showJsonToTablePanel() {
    log('Showing JSON to Table panel');

    const mainContent = document.querySelector('main > .d-flex');
    const resizeDivider = document.getElementById('resizeDivider');
    const timezoneModule = document.getElementById('timezoneConverterModule');

    // Ensure timezone module is completely hidden
    if (timezoneModule) {
        timezoneModule.classList.add('d-none');
        timezoneModule.style.display = 'none';
        timezoneModule.style.visibility = 'hidden';
        timezoneModule.style.opacity = '0';
    }

    // Show main content with explicit styles
    if (mainContent) {
        mainContent.classList.remove('d-none');
        mainContent.style.display = '';
        mainContent.style.visibility = 'visible';
        mainContent.style.opacity = '1';
    }
    if (resizeDivider) {
        resizeDivider.classList.remove('d-none');
        resizeDivider.style.display = '';
    }

    // Hide any coming soon panel
    const comingSoonPanel = document.getElementById('comingSoonPanel');
    if (comingSoonPanel) {
        comingSoonPanel.classList.add('d-none');
        comingSoonPanel.style.display = 'none';
    }
}

// Show Timezone Converter panel
function showTimezoneConverterPanel() {
    log('Showing Timezone Converter panel');

    const mainContent = document.querySelector('main > .d-flex');
    const resizeDivider = document.getElementById('resizeDivider');
    const timezoneModule = document.getElementById('timezoneConverterModule');

    // Hide main content completely
    if (mainContent) {
        mainContent.classList.add('d-none');
        mainContent.style.display = 'none';
    }
    if (resizeDivider) {
        resizeDivider.classList.add('d-none');
        resizeDivider.style.display = 'none';
    }

    // Hide any coming soon panel
    const comingSoonPanel = document.getElementById('comingSoonPanel');
    if (comingSoonPanel) {
        comingSoonPanel.classList.add('d-none');
        comingSoonPanel.style.display = 'none';
    }

    // Show timezone module
    if (timezoneModule) {
        timezoneModule.classList.remove('d-none');
        timezoneModule.classList.add('active');
        log('Timezone module shown successfully');
    } else {
        log('Timezone converter module not found in DOM', 'error');
    }
}

// Show coming soon panel for unimplemented modules
function showComingSoonPanel(moduleName) {
    const mainContent = document.querySelector('main > .d-flex');
    const resizeDivider = document.getElementById('resizeDivider');
    const timezoneModule = document.getElementById('timezoneConverterModule');

    // Hide all other panels completely
    if (mainContent) {
        mainContent.classList.add('d-none');
        mainContent.style.display = 'none';
    }
    if (resizeDivider) {
        resizeDivider.classList.add('d-none');
        resizeDivider.style.display = 'none';
    }
    if (timezoneModule) {
        timezoneModule.classList.add('d-none');
        timezoneModule.style.display = 'none';
    }

    // Create or show coming soon panel
    let comingSoonPanel = document.getElementById('comingSoonPanel');
    if (!comingSoonPanel) {
        comingSoonPanel = document.createElement('div');
        comingSoonPanel.id = 'comingSoonPanel';
        comingSoonPanel.className = 'container-fluid h-100 d-flex flex-column justify-content-center align-items-center bg-light';
        comingSoonPanel.innerHTML = `
            <div class="text-center">
                <i class="bi bi-tools" style="font-size: 4rem; color: #4facfe; opacity: 0.7;"></i>
                <h2 class="mt-4 mb-3">Coming Soon</h2>
                <h4 class="text-muted mb-4" id="comingSoonModuleName">${moduleName}</h4>
                <p class="text-muted mb-4">This feature is currently under development.<br>Check back soon for updates!</p>
                <button class="btn btn-primary" onclick="switchToDefaultModule()">
                    <i class="bi bi-arrow-left me-2"></i>Back to JSON to Table
                </button>
            </div>
        `;
        document.querySelector('main').appendChild(comingSoonPanel);
    } else {
        document.getElementById('comingSoonModuleName').textContent = moduleName;
        comingSoonPanel.classList.remove('d-none');
        comingSoonPanel.classList.add('d-flex');
        comingSoonPanel.style.display = '';
        comingSoonPanel.style.visibility = 'visible';
        comingSoonPanel.style.opacity = '1';
    }
}

// Switch back to default module (JSON to Table)
function switchToDefaultModule() {
    // Update button group UI
    document.querySelectorAll('[data-module]').forEach(btn => {
        btn.classList.remove('active');
    });

    const jsonToTableButton = document.querySelector('[data-module="json-to-table"]');
    if (jsonToTableButton) {
        jsonToTableButton.classList.add('active');
    }

    // Switch to the module
    switchToModule('json-to-table');
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

        // Route to the module specified in URL or show default
        const initialModule = getModuleFromURL();
        log(`Initial module from URL: ${initialModule}`);

        // Set button states
        document.querySelectorAll('[data-module]').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeButton = document.querySelector(`[data-module="${initialModule}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }

        // Switch to the appropriate module
        switchToModule(initialModule);
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
        if (AppConfig.debug && event.error) {
            const errorMessage = event.error.message || 'Unknown error occurred';
            window.AllmightyUtils.showError(`Error: ${errorMessage}`);
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
    init: initApp,
    switchToDefaultModule: switchToDefaultModule
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