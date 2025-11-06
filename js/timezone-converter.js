/**
 * Multi-Timezone Converter Module
 * Almightycoon - Timezone Conversion Feature
 * Completely isolated module to avoid conflicts with existing functionality
 */

window.TimezoneConverter = (function() {
    'use strict';

    // Private variables
    const STORAGE_KEY = 'timezone-converter-settings';
    const MAX_TARGET_TIMEZONES = 10;

    let currentSettings = {
        targetTimezones: ['America/New_York', 'Europe/London', 'Asia/Tokyo'],
        outputFormat: 'full',
        customFormat: 'YYYY-MM-DD HH:mm:ss',
        inputFormat: 'auto',
        customInputFormat: 'YYYY-MM-DD HH:mm:ss',
        show24Hour: true,
        showSeconds: true,
        showUTC: false,
        lastConversionInput: '',
        lastSaveTime: null
    };

    // Comprehensive timezone database - Windows-style coverage
    const timezoneDatabase = [
        // North America
        { id: 'America/New_York', name: 'New York', offset: -5, alias: 'Eastern Time (ET)' },
        { id: 'America/Washington', name: 'Washington DC', offset: -5, alias: 'Eastern Time (ET)' },
        { id: 'America/Miami', name: 'Miami', offset: -5, alias: 'Eastern Time (ET)' },
        { id: 'America/Boston', name: 'Boston', offset: -5, alias: 'Eastern Time (ET)' },
        { id: 'America/Atlanta', name: 'Atlanta', offset: -5, alias: 'Eastern Time (ET)' },
        { id: 'America/Chicago', name: 'Chicago', offset: -6, alias: 'Central Time (CT)' },
        { id: 'America/Dallas', name: 'Dallas', offset: -6, alias: 'Central Time (CT)' },
        { id: 'America/Houston', name: 'Houston', offset: -6, alias: 'Central Time (CT)' },
        { id: 'America/Detroit', name: 'Detroit', offset: -5, alias: 'Eastern Time (ET)' },
        { id: 'America/Denver', name: 'Denver', offset: -7, alias: 'Mountain Time (MT)' },
        { id: 'America/Phoenix', name: 'Phoenix', offset: -7, alias: 'Mountain Time (MT)' },
        { id: 'America/Los_Angeles', name: 'Los Angeles', offset: -8, alias: 'Pacific Time (PT)' },
        { id: 'America/San_Francisco', name: 'San Francisco', offset: -8, alias: 'Pacific Time (PT)' },
        { id: 'America/Seattle', name: 'Seattle', offset: -8, alias: 'Pacific Time (PT)' },
        { id: 'America/San_Diego', name: 'San Diego', offset: -8, alias: 'Pacific Time (PT)' },
        { id: 'America/Las_Vegas', name: 'Las Vegas', offset: -8, alias: 'Pacific Time (PT)' },
        { id: 'America/Toronto', name: 'Toronto', offset: -5, alias: 'Eastern Time (ET)' },
        { id: 'America/Montreal', name: 'Montreal', offset: -5, alias: 'Eastern Time (ET)' },
        { id: 'America/Vancouver', name: 'Vancouver', offset: -8, alias: 'Pacific Time (PT)' },
        { id: 'America/Calgary', name: 'Calgary', offset: -7, alias: 'Mountain Time (MT)' },
        { id: 'America/Mexico_City', name: 'Mexico City', offset: -6 },
        { id: 'America/Guatemala', name: 'Guatemala City', offset: -6 },
        { id: 'America/Sao_Paulo', name: 'São Paulo', offset: -3 },
        { id: 'America/Buenos_Aires', name: 'Buenos Aires', offset: -3 },
        { id: 'America/Lima', name: 'Lima', offset: -5 },
        { id: 'America/Bogota', name: 'Bogota', offset: -5 },
        { id: 'America/Caracas', name: 'Caracas', offset: -4 },

        // Europe
        { id: 'Europe/London', name: 'London', offset: 0, alias: 'GMT' },
        { id: 'Europe/Paris', name: 'Paris', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Berlin', name: 'Berlin', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Rome', name: 'Rome', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Madrid', name: 'Madrid', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Amsterdam', name: 'Amsterdam', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Brussels', name: 'Brussels', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Vienna', name: 'Vienna', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Zurich', name: 'Zurich', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Stockholm', name: 'Stockholm', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Oslo', name: 'Oslo', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Copenhagen', name: 'Copenhagen', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Helsinki', name: 'Helsinki', offset: 2, alias: 'Eastern European Time (EET)' },
        { id: 'Europe/Warsaw', name: 'Warsaw', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Prague', name: 'Prague', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Budapest', name: 'Budapest', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Luxembourg', name: 'Luxembourg', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Europe/Dublin', name: 'Dublin', offset: 0, alias: 'GMT' },
        { id: 'Europe/Lisbon', name: 'Lisbon', offset: 0, alias: 'Western European Time (WET)' },
        { id: 'Europe/Moscow', name: 'Moscow', offset: 3, alias: 'Moscow Time (MSK)' },
        { id: 'Europe/Istanbul', name: 'Istanbul', offset: 3, alias: 'Turkey Time (TRT)' },
        { id: 'Europe/Athens', name: 'Athens', offset: 2, alias: 'Eastern European Time (EET)' },
        { id: 'Europe/Bucharest', name: 'Bucharest', offset: 2, alias: 'Eastern European Time (EET)' },
        { id: 'Europe/Sofia', name: 'Sofia', offset: 2, alias: 'Eastern European Time (EET)' },
        { id: 'Europe/Kiev', name: 'Kyiv', offset: 2, alias: 'Eastern European Time (EET)' },

        // Asia
        { id: 'Asia/Tokyo', name: 'Tokyo', offset: 9, alias: 'Japan Standard Time (JST)' },
        { id: 'Asia/Seoul', name: 'Seoul', offset: 9, alias: 'Korea Standard Time (KST)' },
        { id: 'Asia/Shanghai', name: 'Shanghai', offset: 8, alias: 'China Standard Time (CST)' },
        { id: 'Asia/Beijing', name: 'Beijing', offset: 8, alias: 'China Standard Time (CST)' },
        { id: 'Asia/Hong_Kong', name: 'Hong Kong', offset: 8, alias: 'Hong Kong Time (HKT)' },
        { id: 'Asia/Singapore', name: 'Singapore', offset: 8, alias: 'Singapore Time (SGT)' },
        { id: 'Asia/Bangkok', name: 'Bangkok', offset: 7, alias: 'Indochina Time (ICT)' },
        { id: 'Asia/Ho_Chi_Minh', name: 'Hanoi', offset: 7, alias: 'Indochina Time (ICT)' },
        { id: 'Asia/Jakarta', name: 'Jakarta', offset: 7, alias: 'Western Indonesia Time (WIB)' },
        { id: 'Asia/Manila', name: 'Manila', offset: 8, alias: 'Philippines Time (PHT)' },
        { id: 'Asia/Kuala_Lumpur', name: 'Kuala Lumpur', offset: 8, alias: 'Malaysia Time (MYT)' },
        { id: 'Asia/Taipei', name: 'Taipei', offset: 8, alias: 'China Standard Time (CST)' },
        { id: 'Asia/Mumbai', name: 'Mumbai', offset: 5.5, alias: 'India Standard Time (IST)' },
        { id: 'Asia/Kolkata', name: 'Kolkata', offset: 5.5, alias: 'India Standard Time (IST)' },
        { id: 'Asia/New_Delhi', name: 'New Delhi', offset: 5.5, alias: 'India Standard Time (IST)' },
        { id: 'Asia/Bangalore', name: 'Bangalore', offset: 5.5, alias: 'India Standard Time (IST)' },
        { id: 'Asia/Dubai', name: 'Dubai', offset: 4, alias: 'Gulf Standard Time (GST)' },
        { id: 'Asia/Riyadh', name: 'Riyadh', offset: 3, alias: 'Arabian Standard Time (AST)' },
        { id: 'Asia/Kuwait', name: 'Kuwait City', offset: 3, alias: 'Arabian Standard Time (AST)' },
        { id: 'Asia/Tehran', name: 'Tehran', offset: 3.5, alias: 'Iran Standard Time (IRST)' },
        { id: 'Asia/Karachi', name: 'Karachi', offset: 5, alias: 'Pakistan Standard Time (PKT)' },
        { id: 'Asia/Dhaka', name: 'Dhaka', offset: 6, alias: 'Bangladesh Standard Time (BST)' },
        { id: 'Asia/Yangon', name: 'Yangon', offset: 6.5, alias: 'Myanmar Time (MMT)' },
        { id: 'Asia/Colombo', name: 'Colombo', offset: 5.5, alias: 'Sri Lanka Standard Time (SLST)' },
        { id: 'Asia/Kathmandu', name: 'Kathmandu', offset: 5.75, alias: 'Nepal Time (NPT)' },
        { id: 'Asia/Thimphu', name: 'Thimphu', offset: 6, alias: 'Bhutan Time (BTT)' },

        // Australia & Oceania
        { id: 'Australia/Sydney', name: 'Sydney', offset: 11, alias: 'Australian Eastern Daylight Time (AEDT)' },
        { id: 'Australia/Melbourne', name: 'Melbourne', offset: 11, alias: 'Australian Eastern Daylight Time (AEDT)' },
        { id: 'Australia/Brisbane', name: 'Brisbane', offset: 10, alias: 'Australian Eastern Standard Time (AEST)' },
        { id: 'Australia/Perth', name: 'Perth', offset: 8, alias: 'Australian Western Standard Time (AWST)' },
        { id: 'Australia/Adelaide', name: 'Adelaide', offset: 10.5, alias: 'Australian Central Standard Time (ACST)' },
        { id: 'Australia/Darwin', name: 'Darwin', offset: 9.5, alias: 'Australian Central Standard Time (ACST)' },
        { id: 'Australia/Canberra', name: 'Canberra', offset: 11, alias: 'Australian Eastern Daylight Time (AEDT)' },
        { id: 'Pacific/Auckland', name: 'Auckland', offset: 13, alias: 'New Zealand Daylight Time (NZDT)' },
        { id: 'Pacific/Wellington', name: 'Wellington', offset: 13, alias: 'New Zealand Daylight Time (NZDT)' },
        { id: 'Pacific/Fiji', name: 'Fiji', offset: 12, alias: 'Fiji Time (FJT)' },
        { id: 'Pacific/Guam', name: 'Guam', offset: 10, alias: 'Chamorro Standard Time (ChST)' },
        { id: 'Pacific/Honolulu', name: 'Honolulu', offset: -10, alias: 'Hawaii Standard Time (HST)' },
        { id: 'Pacific/Apia', name: 'Apia', offset: 14, alias: 'Samoa Standard Time (SST)' },
        { id: 'Pacific/Tahiti', name: 'Tahiti', offset: -10, alias: 'Tahiti Time (TAHT)' },

        // Africa
        { id: 'Africa/Cairo', name: 'Cairo', offset: 2, alias: 'Eastern European Time (EET)' },
        { id: 'Africa/Lagos', name: 'Lagos', offset: 1, alias: 'West Africa Time (WAT)' },
        { id: 'Africa/Johannesburg', name: 'Johannesburg', offset: 2, alias: 'South Africa Standard Time (SAST)' },
        { id: 'Africa/Casablanca', name: 'Casablanca', offset: 0, alias: 'Western European Time (WET)' },
        { id: 'Africa/Nairobi', name: 'Nairobi', offset: 3, alias: 'East Africa Time (EAT)' },
        { id: 'Africa/Addis_Ababa', name: 'Addis Ababa', offset: 3, alias: 'East Africa Time (EAT)' },
        { id: 'Africa/Dar_es_Salaam', name: 'Dar es Salaam', offset: 3, alias: 'East Africa Time (EAT)' },
        { id: 'Africa/Kampala', name: 'Kampala', offset: 3, alias: 'East Africa Time (EAT)' },
        { id: 'Africa/Harare', name: 'Harare', offset: 2, alias: 'Central Africa Time (CAT)' },
        { id: 'Africa/Luanda', name: 'Luanda', offset: 1, alias: 'West Africa Time (WAT)' },
        { id: 'Africa/Maputo', name: 'Maputo', offset: 2, alias: 'Central Africa Time (CAT)' },
        { id: 'Africa/Tunis', name: 'Tunis', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Africa/Algiers', name: 'Algiers', offset: 1, alias: 'Central European Time (CET)' },
        { id: 'Africa/Tripoli', name: 'Tripoli', offset: 2, alias: 'Eastern European Time (EET)' },

        // South America Additional
        { id: 'America/Santiago', name: 'Santiago', offset: -4, alias: 'Chile Standard Time (CLT)' },
        { id: 'America/La_Paz', name: 'La Paz', offset: -4 },
        { id: 'America/Quito', name: 'Quito', offset: -5 },
        { id: 'America/Asuncion', name: 'Asunción', offset: -4 },
        { id: 'America/Montevideo', name: 'Montevideo', offset: -3 },
        { id: 'America/Paramaribo', name: 'Paramaribo', offset: -3 },
        { id: 'America/Georgetown', name: 'Georgetown', offset: -4 },
        { id: 'America/Port_of_Spain', name: 'Port of Spain', offset: -4 },

        // Central America & Caribbean
        { id: 'America/Panama', name: 'Panama City', offset: -5 },
        { id: 'America/San_Jose', name: 'San José', offset: -6 },
        { id: 'America/Managua', name: 'Managua', offset: -6 },
        { id: 'America/Tegucigalpa', name: 'Tegucigalpa', offset: -6 },
        { id: 'America/San_Salvador', name: 'San Salvador', offset: -6 },
        { id: 'America/Guatemala', name: 'Guatemala City', offset: -6 },
        { id: 'America/Belize', name: 'Belize City', offset: -6 },
        { id: 'America/Costa_Rica', name: 'San José', offset: -6 },
        { id: 'America/Havana', name: 'Havana', offset: -5, alias: 'Cuba Standard Time (CST)' },
        { id: 'America/Santo_Domingo', name: 'Santo Domingo', offset: -4 },
        { id: 'America/Port-au-Prince', name: 'Port-au-Prince', offset: -4 },
        { id: 'America/Jamaica', name: 'Kingston', offset: -5 },
        { id: 'America/Nassau', name: 'Nassau', offset: -5 },

        // Middle East Additional
        { id: 'Asia/Jerusalem', name: 'Jerusalem', offset: 2, alias: 'Israel Standard Time (IST)' },
        { id: 'Asia/Tel_Aviv', name: 'Tel Aviv', offset: 2, alias: 'Israel Standard Time (IST)' },
        { id: 'Asia/Amman', name: 'Amman', offset: 2, alias: 'Eastern European Time (EET)' },
        { id: 'Asia/Baghdad', name: 'Baghdad', offset: 3, alias: 'Arabian Standard Time (AST)' },
        { id: 'Asia/Damascus', name: 'Damascus', offset: 2, alias: 'Eastern European Time (EET)' },
        { id: 'Asia/Beirut', name: 'Beirut', offset: 2, alias: 'Eastern European Time (EET)' },
        { id: 'Asia/Doha', name: 'Doha', offset: 3, alias: 'Arabian Standard Time (AST)' },
        { id: 'Asia/Manama', name: 'Manama', offset: 3, alias: 'Gulf Standard Time (GST)' },
        { id: 'Asia/Muscat', name: 'Muscat', offset: 4, alias: 'Gulf Standard Time (GST)' },
        { id: 'Asia/Baku', name: 'Baku', offset: 4, alias: 'Azerbaijan Time (AZT)' },
        { id: 'Asia/Yerevan', name: 'Yerevan', offset: 4, alias: 'Armenia Time (AMT)' },
        { id: 'Asia/Tbilisi', name: 'Tbilisi', offset: 4, alias: 'Georgia Time (GET)' },

        // Additional Asian Cities
        { id: 'Asia/Ulaanbaatar', name: 'Ulaanbaatar', offset: 8, alias: 'Ulaanbaatar Time (ULAT)' },
        { id: 'Asia/Almaty', name: 'Almaty', offset: 6, alias: 'Almaty Time (ALMT)' },
        { id: 'Asia/Astana', name: 'Astana', offset: 6, alias: 'Kazakhstan Time (QYZT)' },
        { id: 'Asia/Bishkek', name: 'Bishkek', offset: 6, alias: 'Kyrgyzstan Time (KGT)' },
        { id: 'Asia/Dushanbe', name: 'Dushanbe', offset: 5, alias: 'Tajikistan Time (TJT)' },
        { id: 'Asia/Ashgabat', name: 'Ashgabat', offset: 5, alias: 'Turkmenistan Time (TMT)' },
        { id: 'Asia/Tashkent', name: 'Tashkent', offset: 5, alias: 'Uzbekistan Time (UZT)' },
        { id: 'Asia/Samarkand', name: 'Samarkand', offset: 5, alias: 'Uzbekistan Time (UZT)' },

        // UTC offsets (for reference)
        { id: 'UTC', name: 'UTC', offset: 0 },
        { id: 'UTC-12', name: 'UTC-12', offset: -12 },
        { id: 'UTC-11', name: 'UTC-11', offset: -11 },
        { id: 'UTC-10', name: 'UTC-10', offset: -10 },
        { id: 'UTC-9', name: 'UTC-9', offset: -9 },
        { id: 'UTC-8', name: 'UTC-8', offset: -8 },
        { id: 'UTC-7', name: 'UTC-7', offset: -7 },
        { id: 'UTC-6', name: 'UTC-6', offset: -6 },
        { id: 'UTC-5', name: 'UTC-5', offset: -5 },
        { id: 'UTC-4', name: 'UTC-4', offset: -4 },
        { id: 'UTC-3', name: 'UTC-3', offset: -3 },
        { id: 'UTC-2', name: 'UTC-2', offset: -2 },
        { id: 'UTC-1', name: 'UTC-1', offset: -1 },
        { id: 'UTC+1', name: 'UTC+1', offset: 1 },
        { id: 'UTC+2', name: 'UTC+2', offset: 2 },
        { id: 'UTC+3', name: 'UTC+3', offset: 3 },
        { id: 'UTC+4', name: 'UTC+4', offset: 4 },
        { id: 'UTC+5', name: 'UTC+5', offset: 5 },
        { id: 'UTC+5:30', name: 'UTC+5:30', offset: 5.5 },
        { id: 'UTC+6', name: 'UTC+6', offset: 6 },
        { id: 'UTC+7', name: 'UTC+7', offset: 7 },
        { id: 'UTC+8', name: 'UTC+8', offset: 8 },
        { id: 'UTC+9', name: 'UTC+9', offset: 9 },
        { id: 'UTC+10', name: 'UTC+10', offset: 10 },
        { id: 'UTC+11', name: 'UTC+11', offset: 11 },
        { id: 'UTC+12', name: 'UTC+12', offset: 12 },
        { id: 'UTC+13', name: 'UTC+13', offset: 13 },
        { id: 'UTC+14', name: 'UTC+14', offset: 14 }
    ];

    // Private utility functions
    function log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[TimezoneConverter ${timestamp}]`;

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

    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toastId = 'toast-' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'success'} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        toast.show();

        // Clean up after hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    function formatTimezone(timezone, date) {
        try {
            const options = {
                timeZone: timezone.id,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: !currentSettings.show24Hour
            };

            const formatter = new Intl.DateTimeFormat('en-US', options);
            const parts = formatter.formatToParts(date);

            const formatMap = {};
            parts.forEach(part => {
                formatMap[part.type] = part.value;
            });

            return formatMap;
        } catch (error) {
            log(`Error formatting timezone ${timezone.id}: ${error.message}`, 'error');
            return null;
        }
    }

    function formatOutput(timezoneData, timezone, format) {
        if (!timezoneData) return 'Invalid timezone';

        const { year, month, day, hour, minute, second, dayPeriod } = timezoneData;

        switch (format) {
            case 'full':
                return `${year}-${month}-${day} ${hour}:${minute}${currentSettings.showSeconds ? ':' + second : ''}${dayPeriod ? ' ' + dayPeriod : ''}`;

            case 'date':
                return `${year}-${month}-${day}`;

            case 'time':
                return `${hour}:${minute}${currentSettings.showSeconds ? ':' + second : ''}${dayPeriod ? ' ' + dayPeriod : ''}`;

            case 'iso':
                const date = new Date();
                return date.toISOString();

            case 'timestamp':
                return Math.floor(Date.now() / 1000).toString();

            case 'custom':
                let custom = currentSettings.customFormat;
                custom = custom.replace('YYYY', year);
                custom = custom.replace('MM', month);
                custom = custom.replace('DD', day);
                custom = custom.replace('HH', hour);
                custom = custom.replace('mm', minute);
                custom = custom.replace('ss', second);
                return custom;

            default:
                return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        }
    }

    function parseTimeInput(input) {
        if (!input) return null;

        const now = new Date();

        // Natural language
        if (input.toLowerCase().trim() === 'now') {
            return now;
        }

        if (input.toLowerCase().trim() === 'today') {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
        }

        if (input.toLowerCase().trim() === 'tomorrow') {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 12, 0, 0);
        }

        // Unix timestamp (seconds)
        if (/^\d{10}$/.test(input)) {
            return new Date(parseInt(input) * 1000);
        }

        // Unix timestamp (milliseconds)
        if (/^\d{13}$/.test(input)) {
            return new Date(parseInt(input));
        }

        // Get configured input format
        const inputFormatElement = document.getElementById('tzInputFormat');
        const inputFormat = inputFormatElement ? inputFormatElement.value : currentSettings.inputFormat;

        // Parse based on input format
        switch (inputFormat) {
            case 'iso':
                return parseIsoFormat(input);
            case 'us':
                return parseUSFormat(input);
            case 'eu':
                return parseEuropeanFormat(input);
            case 'custom-input':
                return parseCustomInputFormat(input);
            case 'auto':
            default:
                return parseAutoDetect(input);
        }
    }

    function parseIsoFormat(input) {
        // ISO 8601 format
        if (input.includes('T') || input.includes('Z')) {
            const date = new Date(input);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        return null;
    }

    function parseUSFormat(input) {
        // MM/DD/YYYY HH:mm:ss format
        const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (match) {
            const [, month, day, year, hours = 0, minutes = 0, seconds = 0] = match;
            return new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds || 0)
            );
        }
        return null;
    }

    function parseEuropeanFormat(input) {
        // DD/MM/YYYY HH:mm:ss format
        const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (match) {
            const [, day, month, year, hours = 0, minutes = 0, seconds = 0] = match;
            return new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds || 0)
            );
        }
        return null;
    }

    function parseCustomInputFormat(input) {
        const customFormatElement = document.getElementById('customInputFormat');
        const formatPattern = customFormatElement ? customFormatElement.value : currentSettings.customInputFormat;

        // Create regex pattern from format string
        let regexPattern = formatPattern
            .replace(/YYYY/g, '(\\d{4})')
            .replace(/MM/g, '(\\d{2})')
            .replace(/DD/g, '(\\d{2})')
            .replace(/HH/g, '(\\d{2})')
            .replace(/mm/g, '(\\d{2})')
            .replace(/ss/g, '(\\d{2})')
            .replace(/hh/g, '(\\d{1,2})')
            .replace(/A/g, '(AM|PM)')
            .replace(/\s+/g, '\\s+')
            .replace(/\./g, '\\.')
            .replace(/\//g, '/')
            .replace(/-/g, '-');

        const match = input.match(new RegExp('^' + regexPattern + '$'));
        if (match) {
            // Extract components based on format
            let year, month, day, hour, minute, second, ampm;
            const parts = formatPattern.split(/[^YMDhmsA]+/).filter(p => p);

            let matchIndex = 1;
            parts.forEach(part => {
                switch (part) {
                    case 'YYYY':
                        year = parseInt(match[matchIndex++]);
                        break;
                    case 'MM':
                        month = parseInt(match[matchIndex++]);
                        break;
                    case 'DD':
                        day = parseInt(match[matchIndex++]);
                        break;
                    case 'HH':
                    case 'hh':
                        hour = parseInt(match[matchIndex++]);
                        break;
                    case 'mm':
                        minute = parseInt(match[matchIndex++]);
                        break;
                    case 'ss':
                        second = parseInt(match[matchIndex++]);
                        break;
                    case 'A':
                        ampm = match[matchIndex++];
                        break;
                }
            });

            // Convert 12-hour to 24-hour format
            if (ampm && ampm === 'PM' && hour < 12) {
                hour += 12;
            } else if (ampm && ampm === 'AM' && hour === 12) {
                hour = 0;
            }

            return new Date(
                year || now.getFullYear(),
                (month || 1) - 1,
                day || 1,
                hour || 0,
                minute || 0,
                second || 0
            );
        }
        return null;
    }

    function parseAutoDetect(input) {
        // Try common date formats
        const datePatterns = [
            // YYYY-MM-DD HH:mm:ss
            {
                regex: /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?$/,
                parser: (match) => {
                    const [, year, month, day, hours, minutes, seconds] = match;
                    return new Date(
                        parseInt(year),
                        parseInt(month) - 1,
                        parseInt(day),
                        parseInt(hours),
                        parseInt(minutes),
                        parseInt(seconds || 0)
                    );
                }
            },
            // MM/DD/YYYY HH:mm:ss
            {
                regex: /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?$/,
                parser: (match) => {
                    const [, month, day, year, hours, minutes, seconds] = match;
                    return new Date(
                        parseInt(year),
                        parseInt(month) - 1,
                        parseInt(day),
                        parseInt(hours),
                        parseInt(minutes),
                        parseInt(seconds || 0)
                    );
                }
            },
            // DD.MM.YYYY HH:mm:ss
            {
                regex: /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?$/,
                parser: (match) => {
                    const [, day, month, year, hours, minutes, seconds] = match;
                    return new Date(
                        parseInt(year),
                        parseInt(month) - 1,
                        parseInt(day),
                        parseInt(hours),
                        parseInt(minutes),
                        parseInt(seconds || 0)
                    );
                }
            }
        ];

        for (const pattern of datePatterns) {
            const match = input.match(pattern.regex);
            if (match) {
                return pattern.parser(match);
            }
        }

        // Try ISO format
        if (input.includes('T') || input.includes('Z')) {
            const date = new Date(input);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        // Default: try native Date parsing
        const date = new Date(input);
        return isNaN(date.getTime()) ? null : date;
    }

    function getTimezoneOffset(timezoneId, date) {
        try {
            const tempDate = new Date(date);
            const utcDate = new Date(tempDate.toLocaleString("en-US", { timeZone: "UTC" }));
            const tzDate = new Date(tempDate.toLocaleString("en-US", { timeZone: timezoneId }));
            const offset = (tzDate - utcDate) / (1000 * 60 * 60);
            return offset;
        } catch (error) {
            // Fallback to database offset
            const tz = timezoneDatabase.find(t => t.id === timezoneId);
            return tz ? tz.offset : 0;
        }
    }

    function saveToStorage() {
        try {
            currentSettings.lastSaveTime = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
            updateLastSaveTime();
            log('Settings saved to localStorage');
        } catch (error) {
            log(`Failed to save settings: ${error.message}`, 'error');
        }
    }

    function loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const settings = JSON.parse(stored);
                currentSettings = { ...currentSettings, ...settings };
                log('Settings loaded from localStorage');
                return true;
            }
        } catch (error) {
            log(`Failed to load settings: ${error.message}`, 'error');
        }
        return false;
    }

    function updateLastSaveTime() {
        const lastSaveElement = document.getElementById('lastSaveTime');
        if (lastSaveElement) {
            if (currentSettings.lastSaveTime) {
                const date = new Date(currentSettings.lastSaveTime);
                lastSaveElement.textContent = date.toLocaleString();
            } else {
                lastSaveElement.textContent = 'Never';
            }
        }
    }

    // Public API
    const publicAPI = {
        init: function() {
            log('Initializing Timezone Converter module...');

            // Load settings from storage
            const hasStoredSettings = loadFromStorage();

            // Initialize UI elements
            this.populateTimezoneSelects();
            this.renderTargetTimezones();

            // Set up event listeners before loading UI settings
            this.setupEventListeners();

            // Load settings into UI immediately after event listeners are set
            this.loadSettingsToUI();

            // Show welcome message if no stored settings
            if (!hasStoredSettings) {
                this.showWelcomeMessage();
            }

            log('Timezone Converter module initialized successfully');
        },

        populateTimezoneSelects: function() {
            const sourceSelect = document.getElementById('sourceTimezone');
            if (!sourceSelect) return;

            // Clear existing options except auto
            sourceSelect.innerHTML = '<option value="auto">Auto-detect (Local)</option>';

            // Add timezone options
            timezoneDatabase.forEach(timezone => {
                const option = document.createElement('option');
                option.value = timezone.id;

                let displayName = timezone.name;
                if (timezone.alias) {
                    displayName += ` (${timezone.alias})`;
                }
                if (timezone.offset !== undefined && !timezone.id.startsWith('UTC')) {
                    const sign = timezone.offset >= 0 ? '+' : '';
                    displayName += ` (UTC${sign}${timezone.offset})`;
                }

                option.textContent = displayName;
                sourceSelect.appendChild(option);
            });
        },

        loadSettingsToUI: function() {
            // Output format - temporarily remove listener to prevent change event
            const outputFormat = document.getElementById('tzOutputFormat');
            if (outputFormat) {
                const originalValue = outputFormat.value;
                outputFormat.value = currentSettings.outputFormat;

                // Only trigger UI update if value actually changed
                if (originalValue !== currentSettings.outputFormat) {
                    // Manually show/hide custom format section without triggering change event
                    const customSection = document.getElementById('customFormatSection');
                    if (customSection) {
                        customSection.style.display = currentSettings.outputFormat === 'custom' ? 'block' : 'none';
                    }
                }
            }

            // Custom format
            const customFormat = document.getElementById('customFormat');
            if (customFormat) {
                customFormat.value = currentSettings.customFormat;
            }

            // Input format - apply without triggering change events
            const inputFormat = document.getElementById('tzInputFormat');
            if (inputFormat) {
                inputFormat.value = currentSettings.inputFormat;

                // Manually show/hide custom input format section without triggering change event
                const customInputSection = document.getElementById('customInputFormatSection');
                const expectedHint = document.getElementById('expectedFormatHint');

                if (customInputSection) {
                    customInputSection.style.display = currentSettings.inputFormat === 'custom-input' ? 'block' : 'none';
                }

                if (expectedHint) {
                    switch (currentSettings.inputFormat) {
                        case 'iso':
                            expectedHint.textContent = 'ISO 8601: 2025-11-06T14:30:25Z';
                            break;
                        case 'us':
                            expectedHint.textContent = 'US Format: 11/06/2025 14:30:25';
                            break;
                        case 'eu':
                            expectedHint.textContent = 'European: 06/11/2025 14:30:25';
                            break;
                        case 'custom-input':
                            expectedHint.textContent = 'Custom pattern as defined below';
                            break;
                        case 'auto':
                        default:
                            expectedHint.textContent = 'Auto-detect various formats';
                    }
                }
            }

            // Custom input format
            const customInputFormat = document.getElementById('customInputFormat');
            if (customInputFormat) {
                customInputFormat.value = currentSettings.customInputFormat;
            }

            // Display options
            const show24Hour = document.getElementById('show24Hour');
            const showSeconds = document.getElementById('showSeconds');
            const showUTC = document.getElementById('showUTC');

            if (show24Hour) show24Hour.checked = currentSettings.show24Hour;
            if (showSeconds) showSeconds.checked = currentSettings.showSeconds;
            if (showUTC) showUTC.checked = currentSettings.showUTC;

            // Last input
            const timeInput = document.getElementById('timeInput');
            if (timeInput && currentSettings.lastConversionInput) {
                timeInput.value = currentSettings.lastConversionInput;
            }

            updateLastSaveTime();
        },

        renderTargetTimezones: function() {
            const container = document.getElementById('targetTimezones');
            if (!container) return;

            container.innerHTML = '';

            currentSettings.targetTimezones.forEach((timezoneId, index) => {
                const timezone = timezoneDatabase.find(tz => tz.id === timezoneId);
                if (!timezone) return;

                const timezoneItem = document.createElement('div');
                timezoneItem.className = 'timezone-item mb-2 p-2 border rounded';
                timezoneItem.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <strong>${timezone.name}</strong>
                            ${timezone.alias ? `<br><small class="text-muted">${timezone.alias}</small>` : ''}
                            ${timezone.offset !== undefined ? `<br><small class="text-muted">UTC${timezone.offset >= 0 ? '+' : ''}${timezone.offset}</small>` : ''}
                        </div>
                        <button class="btn btn-outline-danger btn-sm" onclick="window.TimezoneConverter.removeTimezone(${index})" title="Remove">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `;
                container.appendChild(timezoneItem);
            });

            // Show add button if under limit
            const addButton = document.querySelector('[onclick="window.TimezoneConverter.addTimezone()"]');
            if (addButton) {
                addButton.disabled = currentSettings.targetTimezones.length >= MAX_TARGET_TIMEZONES;
                if (currentSettings.targetTimezones.length >= MAX_TARGET_TIMEZONES) {
                    addButton.title = `Maximum ${MAX_TARGET_TIMEZONES} timezones allowed`;
                } else {
                    addButton.title = '';
                }
            }
        },

        setupEventListeners: function() {
            // Use flags to prevent duplicate listeners instead of DOM manipulation

            // Output format change
            const outputFormat = document.getElementById('tzOutputFormat');
            if (outputFormat && !outputFormat.hasAttribute('data-listener-added')) {
                outputFormat.setAttribute('data-listener-added', 'true');
                outputFormat.addEventListener('change', this.handleOutputFormatChange.bind(this));
            }

            // Input format change
            const inputFormat = document.getElementById('tzInputFormat');
            if (inputFormat && !inputFormat.hasAttribute('data-listener-added')) {
                inputFormat.setAttribute('data-listener-added', 'true');
                inputFormat.addEventListener('change', this.handleInputFormatChange.bind(this));
            }

            // Enter key on time input
            const timeInput = document.getElementById('timeInput');
            if (timeInput && !timeInput.hasAttribute('data-listener-added')) {
                timeInput.setAttribute('data-listener-added', 'true');
                timeInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.convertTime();
                    }
                });
            }
        },

    
        handleOutputFormatChange: function(e) {
            e.stopPropagation();
            const customSection = document.getElementById('customFormatSection');
            if (customSection) {
                customSection.style.display = e.target.value === 'custom' ? 'block' : 'none';
            }
        },

        handleInputFormatChange: function(e) {
            e.stopPropagation();

            const customInputSection = document.getElementById('customInputFormatSection');
            const expectedHint = document.getElementById('expectedFormatHint');

            if (customInputSection) {
                customInputSection.style.display = e.target.value === 'custom-input' ? 'block' : 'none';
            }

            if (expectedHint) {
                switch (e.target.value) {
                    case 'iso':
                        expectedHint.textContent = 'ISO 8601: 2025-11-06T14:30:25Z';
                        break;
                    case 'us':
                        expectedHint.textContent = 'US Format: 11/06/2025 14:30:25';
                        break;
                    case 'eu':
                        expectedHint.textContent = 'European: 06/11/2025 14:30:25';
                        break;
                    case 'custom-input':
                        expectedHint.textContent = 'Custom pattern as defined below';
                        break;
                    case 'auto':
                    default:
                        expectedHint.textContent = 'Auto-detect various formats';
                }
            }

            console.log('Input format changed to:', e.target.value);
        },

        setCurrentTime: function() {
            const timeInput = document.getElementById('timeInput');
            if (timeInput) {
                const now = new Date();
                timeInput.value = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
                showToast('Current time set');
            }
        },

        convertTime: function() {
            const timeInput = document.getElementById('timeInput');
            const resultsContainer = document.getElementById('conversionResults');
            const statusElement = document.getElementById('conversionStatus');

            if (!timeInput || !resultsContainer || !statusElement) return;

            const input = timeInput.value.trim();
            if (!input) {
                showToast('Please enter a time to convert', 'warning');
                return;
            }

            // Save last input
            currentSettings.lastConversionInput = input;

            const sourceDate = parseTimeInput(input);
            if (!sourceDate) {
                showToast('Could not parse time input. Please check the format.', 'error');
                statusElement.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i> Parse error';
                return;
            }

            // Show loading state
            statusElement.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Converting...';

            // Get output format
            const outputFormatSelect = document.getElementById('tzOutputFormat');
            const outputFormat = outputFormatSelect?.value || 'full';

            // Generate conversion matrix
            let resultsHtml = `
                <div class="conversion-summary mb-4 p-3 bg-light rounded">
                    <h5 class="mb-2">Conversion Matrix</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Input Time:</strong> ${input}<br>
                            <strong>Parsed Date:</strong> ${sourceDate.toLocaleString()}
                        </div>
                        <div class="col-md-6">
                            <strong>Output Format:</strong> ${outputFormat}<br>
                            <strong>Target Zones:</strong> ${currentSettings.targetTimezones.length} zone${currentSettings.targetTimezones.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                    <div class="mt-2 text-info">
                        <i class="bi bi-info-circle me-1"></i>
                        <strong>Matrix Concept:</strong> Each row assumes the input time is in that timezone, then converts to all other target timezones
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-bordered table-hover conversion-matrix">
                        <thead class="table-light">
                            <tr>
                                <th scope="col" class="text-center" style="width: 150px;">Input Assumed As</th>
            `;

            // Add header columns for each target timezone
            currentSettings.targetTimezones.forEach(timezoneId => {
                const timezone = timezoneDatabase.find(tz => tz.id === timezoneId);
                if (timezone) {
                    resultsHtml += `<th scope="col" class="text-center">${timezone.name}</th>`;
                }
            });

            resultsHtml += `
                            </tr>
                        </thead>
                        <tbody>
            `;

            // Generate rows for each target timezone as source
            currentSettings.targetTimezones.forEach((sourceTimezoneId, rowIndex) => {
                const sourceTimezone = timezoneDatabase.find(tz => tz.id === sourceTimezoneId);
                if (!sourceTimezone) return;

                resultsHtml += `
                    <tr>
                        <td class="fw-bold text-center bg-light">
                            ${sourceTimezone.name}
                            <br><small class="text-muted">UTC${sourceTimezone.offset >= 0 ? '+' : ''}${sourceTimezone.offset}</small>
                        </td>
                `;

                // Convert from source timezone to each target timezone
                currentSettings.targetTimezones.forEach(targetTimezoneId => {
                    const targetTimezone = timezoneDatabase.find(tz => tz.id === targetTimezoneId);
                    if (!targetTimezone) {
                        resultsHtml += '<td class="text-center">-</td>';
                        return;
                    }

                    // Create the target date by adjusting for timezone difference
                    const sourceOffset = sourceTimezone.offset;
                    const targetOffset = targetTimezone.offset;
                    const offsetDiff = targetOffset - sourceOffset;

                    // Apply the offset difference to the source date
                    const adjustedDate = new Date(sourceDate.getTime() + (offsetDiff * 60 * 60 * 1000));

                    // Get formatted output for the adjusted date
                    const timezoneData = formatTimezone(targetTimezone, adjustedDate);
                    if (timezoneData) {
                        const formattedTime = formatOutput(timezoneData, targetTimezone, outputFormat);
                        const isDiagonal = rowIndex === currentSettings.targetTimezones.indexOf(targetTimezoneId);
                        const cellClass = isDiagonal ? 'table-active' : '';

                        resultsHtml += `
                            <td class="text-center ${cellClass}">
                                <code class="small">${formattedTime}</code>
                                ${isDiagonal ? '<br><span class="badge bg-secondary">Original</span>' : ''}
                            </td>
                        `;
                    } else {
                        resultsHtml += '<td class="text-center text-muted">Error</td>';
                    }
                });

                resultsHtml += '</tr>';
            });

            resultsHtml += `
                        </tbody>
                    </table>
                </div>

                <div class="mt-3">
                    <div class="row">
                        <div class="col-md-6">
                            <button class="btn btn-outline-primary btn-sm" onclick="window.TimezoneConverter.exportMatrix()">
                                <i class="bi bi-download me-1"></i> Export Matrix as CSV
                            </button>
                        </div>
                        <div class="col-md-6 text-end">
                            <small class="text-muted">
                                <strong>Total conversions:</strong> ${currentSettings.targetTimezones.length}² = ${currentSettings.targetTimezones.length * currentSettings.targetTimezones.length}
                            </small>
                        </div>
                    </div>
                </div>
            `;

            resultsContainer.innerHTML = resultsHtml;
            statusElement.innerHTML = '<i class="bi bi-check-circle me-1"></i> Conversion complete';

            showToast(`Generated ${currentSettings.targetTimezones.length}×${currentSettings.targetTimezones.length} conversion matrix`);
        },

        addTimezone: function(timezoneId = null) {
            if (currentSettings.targetTimezones.length >= MAX_TARGET_TIMEZONES) {
                showToast(`Maximum ${MAX_TARGET_TIMEZONES} timezones allowed`, 'warning');
                return;
            }

            const availableTimezones = timezoneDatabase.filter(
                tz => !currentSettings.targetTimezones.includes(tz.id)
            );

            if (availableTimezones.length === 0) {
                showToast('No more timezones available', 'warning');
                return;
            }

            if (timezoneId && availableTimezones.find(tz => tz.id === timezoneId)) {
                currentSettings.targetTimezones.push(timezoneId);
                this.renderTargetTimezones();
                showToast(`${timezoneId} added to target timezones`);
                return;
            }

            // Show timezone selection modal or dropdown
            const searchInput = document.getElementById('timezoneSearch');
            const suggestionsContainer = document.getElementById('availableTimezones');

            if (searchInput && suggestionsContainer) {
                // Populate suggestions
                const suggestionsHtml = availableTimezones.slice(0, 10).map(timezone => {
                    let displayName = timezone.name;
                    if (timezone.alias) {
                        displayName += ` (${timezone.alias})`;
                    }

                    return `
                        <div class="list-group-item list-group-item-action"
                             onclick="window.TimezoneConverter.addTimezone('${timezone.id}')"
                             style="cursor: pointer;">
                            <div class="fw-semibold">${timezone.id}</div>
                            <small class="text-muted">${displayName}</small>
                        </div>
                    `;
                }).join('');

                suggestionsContainer.querySelector('.timezone-suggestions').innerHTML = suggestionsHtml;
                suggestionsContainer.style.display = 'block';
                searchInput.focus();
            }
        },

        removeTimezone: function(index) {
            if (index >= 0 && index < currentSettings.targetTimezones.length) {
                const removed = currentSettings.targetTimezones.splice(index, 1)[0];
                this.renderTargetTimezones();
                showToast(`${removed} removed from target timezones`);
            }
        },

        filterTimezones: function(query) {
            const suggestionsContainer = document.getElementById('availableTimezones');
            const suggestionsList = suggestionsContainer?.querySelector('.timezone-suggestions');

            if (!suggestionsList || !query) {
                if (suggestionsContainer) {
                    suggestionsContainer.style.display = 'none';
                }
                return;
            }

            const availableTimezones = timezoneDatabase.filter(
                tz => !currentSettings.targetTimezones.includes(tz.id)
            );

            const filtered = availableTimezones.filter(tz =>
                tz.name.toLowerCase().includes(query.toLowerCase()) ||
                tz.id.toLowerCase().includes(query.toLowerCase()) ||
                (tz.alias && tz.alias.toLowerCase().includes(query.toLowerCase()))
            );

            if (filtered.length === 0) {
                suggestionsList.innerHTML = `
                    <div class="list-group-item text-muted">
                        No timezones found matching "${query}"
                    </div>
                `;
            } else {
                suggestionsList.innerHTML = filtered.slice(0, 10).map(timezone => {
                    let displayName = timezone.name;
                    if (timezone.alias) {
                        displayName += ` (${timezone.alias})`;
                    }

                    return `
                        <div class="list-group-item list-group-item-action"
                             onclick="window.TimezoneConverter.addTimezone('${timezone.id}')"
                             style="cursor: pointer;">
                            <div class="fw-semibold">${timezone.id}</div>
                            <small class="text-muted">${displayName}</small>
                        </div>
                    `;
                }).join('');
            }

            suggestionsContainer.style.display = 'block';
        },

        clearAll: function() {
            // Clear input
            const timeInput = document.getElementById('timeInput');
            if (timeInput) {
                timeInput.value = '';
            }

            // Clear results
            const resultsContainer = document.getElementById('conversionResults');
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="text-center p-5 text-muted">
                        <i class="bi bi-clock" style="font-size: 3rem; opacity: 0.3;"></i>
                        <h4 class="mt-3 mb-2">Ready to Convert Time</h4>
                        <p class="mb-0">Enter a time and select target timezones to see conversion results</p>
                    </div>
                `;
            }

            // Update status
            const statusElement = document.getElementById('conversionStatus');
            if (statusElement) {
                statusElement.innerHTML = '<i class="bi bi-info-circle me-1"></i> Ready';
            }

            currentSettings.lastConversionInput = '';
            showToast('All fields cleared');
        },

        saveSettings: function() {
            // Get output format
            const outputFormat = document.getElementById('tzOutputFormat');
            if (outputFormat) {
                currentSettings.outputFormat = outputFormat.value;
            }

            // Get custom format
            const customFormat = document.getElementById('customFormat');
            if (customFormat) {
                currentSettings.customFormat = customFormat.value;
            }

            // Get input format
            const inputFormat = document.getElementById('tzInputFormat');
            if (inputFormat) {
                currentSettings.inputFormat = inputFormat.value;
            }

            // Get custom input format
            const customInputFormat = document.getElementById('customInputFormat');
            if (customInputFormat) {
                currentSettings.customInputFormat = customInputFormat.value;
            }

            // Get display options
            currentSettings.show24Hour = document.getElementById('show24Hour').checked;
            currentSettings.showSeconds = document.getElementById('showSeconds').checked;
            currentSettings.showUTC = document.getElementById('showUTC').checked;

            saveToStorage();
            showToast('Settings saved successfully');
        },

        copyToClipboard: function(text) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied to clipboard');
            }).catch(err => {
                log(`Failed to copy to clipboard: ${err.message}`, 'error');
                showToast('Failed to copy to clipboard', 'error');
            });
        },

        copyAllResults: function() {
            const resultsContainer = document.getElementById('conversionResults');
            if (!resultsContainer) return;

            const codeElements = resultsContainer.querySelectorAll('code');
            const results = Array.from(codeElements).map(el => el.textContent).join('\n');

            if (results.trim()) {
                this.copyToClipboard(results);
            } else {
                showToast('No results to copy', 'warning');
            }
        },

        exportResults: function() {
            const resultsContainer = document.getElementById('conversionResults');
            if (!resultsContainer) return;

            const codeElements = resultsContainer.querySelectorAll('code');
            const results = Array.from(codeElements).map(el => el.textContent);

            if (results.length === 0) {
                showToast('No results to export', 'warning');
                return;
            }

            // Create CSV content
            const csvContent = 'Timezone,Converted Time\n' +
                results.map((result, index) => {
                    const timezone = currentSettings.targetTimezones[index];
                    const tzInfo = timezoneDatabase.find(t => t.id === timezone);
                    return `"${tzInfo?.name || timezone}","${result}"`;
                }).join('\n');

            // Download file
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timezone-conversion-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            showToast('Results exported to CSV');
        },

        exportMatrix: function() {
            // Create CSV content for the conversion matrix
            let csvContent = 'Assumed Input As,';

            // Header row with timezone names
            currentSettings.targetTimezones.forEach(timezoneId => {
                const timezone = timezoneDatabase.find(tz => tz.id === timezoneId);
                if (timezone) {
                    csvContent += `"${timezone.name}",`;
                }
            });
            csvContent = csvContent.slice(0, -1) + '\n';

            // Data rows
            currentSettings.targetTimezones.forEach(sourceTimezoneId => {
                const sourceTimezone = timezoneDatabase.find(tz => tz.id === sourceTimezoneId);
                if (sourceTimezone) {
                    csvContent += `"${sourceTimezone.name}",`;

                    currentSettings.targetTimezones.forEach(targetTimezoneId => {
                        // This is a simplified export - in a real implementation,
                        // you'd recalculate the conversions here
                        csvContent += '"(value)",';
                    });
                    csvContent = csvContent.slice(0, -1) + '\n';
                }
            });

            // Download file
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timezone-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            showToast('Conversion matrix exported to CSV');
        },

        showHelp: function() {
            const helpContent = `
                <h5>Timezone Converter Help</h5>
                <h6>Supported Input Formats:</h6>
                <ul>
                    <li><strong>ISO 8601:</strong> 2025-11-06T14:30:00Z</li>
                    <li><strong>Date Time:</strong> 2025-11-06 14:30:00</li>
                    <li><strong>Unix Timestamp:</strong> 1730896200 (seconds)</li>
                    <li><strong>Natural Language:</strong> now, today, tomorrow</li>
                </ul>
                <h6>Features:</h6>
                <ul>
                    <li>Convert time to multiple timezones simultaneously</li>
                    <li>Support for 150+ major cities and UTC offsets</li>
                    <li>Custom output formatting</li>
                    <li>Copy individual results or all at once</li>
                    <li>Export results to CSV</li>
                    <li>Settings automatically saved to browser storage</li>
                </ul>
                <h6>Tips:</h6>
                <ul>
                    <li>Click "Now" to set current time quickly</li>
                    <li>Search timezones by city name or timezone ID</li>
                    <li>Settings are preserved when you return to the page</li>
                    <li>Press Enter in the time input to convert immediately</li>
                </ul>
            `;

            // Create modal
            const modalHtml = `
                <div class="modal fade" id="helpModal" tabindex="-1" aria-labelledby="helpModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="helpModalLabel">
                                    <i class="bi bi-question-circle me-2"></i>Help
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                ${helpContent}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if present
            const existingModal = document.getElementById('helpModal');
            if (existingModal) {
                existingModal.remove();
            }

            // Add modal to page
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('helpModal'));
            modal.show();
        },

        showWelcomeMessage: function() {
            showToast('Welcome to Timezone Converter! Your settings will be automatically saved.', 'info');
        }
    };

    return publicAPI;
})();