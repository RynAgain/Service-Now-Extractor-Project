// ==UserScript==
// @name         ServiceNow Extractor - Storage Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Settings storage management for ServiceNow Ticket Extractor
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // Storage management object
    window.SNExtractorStorage = {
        // Default settings
        defaults: {
            selectedFields: ['number', 'short_description', 'state', 'priority', 'assigned_to', 'assignment_group', 'opened_at', 'sys_id'],
            selectedTables: ['incident'],
            filters: [],
            currentTheme: 'wholefoodsGreen'
        },

        // Load saved settings
        loadSettings: function() {
            try {
                const settings = {
                    selectedFields: JSON.parse(GM_getValue('selectedFields', '[]')),
                    selectedTables: JSON.parse(GM_getValue('selectedTables', '["incident"]')),
                    filters: JSON.parse(GM_getValue('filters', '[]')),
                    currentTheme: GM_getValue('currentTheme', 'wholefoodsGreen')
                };

                // Use defaults if empty
                if (settings.selectedFields.length === 0) {
                    settings.selectedFields = [...this.defaults.selectedFields];
                }

                return settings;
            } catch (e) {
                console.warn('Failed to load settings:', e);
                return { ...this.defaults };
            }
        },

        // Save settings
        saveSettings: function(settings) {
            try {
                GM_setValue('selectedFields', JSON.stringify(settings.selectedFields));
                GM_setValue('selectedTables', JSON.stringify(settings.selectedTables));
                GM_setValue('filters', JSON.stringify(settings.filters));
                GM_setValue('currentTheme', settings.currentTheme);
            } catch (e) {
                console.warn('Failed to save settings:', e);
            }
        },

        // Save individual setting
        saveSetting: function(key, value) {
            try {
                if (typeof value === 'object') {
                    GM_setValue(key, JSON.stringify(value));
                } else {
                    GM_setValue(key, value);
                }
            } catch (e) {
                console.warn(`Failed to save setting ${key}:`, e);
            }
        },

        // Get individual setting
        getSetting: function(key, defaultValue) {
            try {
                const value = GM_getValue(key, defaultValue);
                if (typeof defaultValue === 'object' && typeof value === 'string') {
                    return JSON.parse(value);
                }
                return value;
            } catch (e) {
                console.warn(`Failed to get setting ${key}:`, e);
                return defaultValue;
            }
        }
    };

})();