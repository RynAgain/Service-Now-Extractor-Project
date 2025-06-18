// ==UserScript==
// @name         ServiceNow Extractor - Configuration Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Configuration constants for ServiceNow Ticket Extractor
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration object
    window.SNExtractorConfig = {
        BASE_URL: window.location.origin,

        AVAILABLE_TABLES: {
            'incident': {
                name: 'Incidents',
                description: 'IT service disruptions and issues'
            },
            'sc_request': {
                name: 'Service Requests',
                description: 'User requests for services or items'
            },
            'sc_task': {
                name: 'Catalog Tasks',
                description: 'Tasks created from service requests'
            },
            'change_request': {
                name: 'Change Requests',
                description: 'Changes to IT infrastructure'
            },
            'problem': {
                name: 'Problems',
                description: 'Root cause of incidents'
            }
        },

        AVAILABLE_FIELDS: {
            'number': {
                name: 'Ticket Number',
                description: 'Unique identifier (e.g., INC0001234)'
            },
            'short_description': {
                name: 'Short Description',
                description: 'Brief summary of the issue'
            },
            'description': {
                name: 'Description',
                description: 'Detailed description of the issue'
            },
            'state': {
                name: 'State',
                description: 'Current status of the ticket'
            },
            'priority': {
                name: 'Priority',
                description: 'Business priority level'
            },
            'urgency': {
                name: 'Urgency',
                description: 'How quickly resolution is needed'
            },
            'impact': {
                name: 'Impact',
                description: 'Business impact level'
            },
            'category': {
                name: 'Category',
                description: 'Primary classification'
            },
            'subcategory': {
                name: 'Subcategory',
                description: 'Secondary classification'
            },
            'assigned_to': {
                name: 'Assigned To',
                description: 'Person responsible for resolution'
            },
            'assignment_group': {
                name: 'Assignment Group',
                description: 'Team responsible for resolution'
            },
            'opened_at': {
                name: 'Opened At',
                description: 'When the ticket was created'
            },
            'updated_at': {
                name: 'Updated At',
                description: 'Last modification time'
            },
            'sys_created_on': {
                name: 'Created On',
                description: 'System creation timestamp'
            },
            'caller_id': {
                name: 'Caller',
                description: 'Person who reported the issue'
            },
            'sys_id': {
                name: 'System ID',
                description: 'Internal database identifier'
            },
            'close_code': {
                name: 'Close Code',
                description: 'Resolution classification'
            },
            'close_notes': {
                name: 'Close Notes',
                description: 'Resolution details'
            },
            'work_notes': {
                name: 'Work Notes',
                description: 'Internal work documentation'
            },
            'business_service': {
                name: 'Business Service',
                description: 'Affected service'
            },
            'cmdb_ci': {
                name: 'Configuration Item',
                description: 'Affected infrastructure component'
            },
            'location': {
                name: 'Location',
                description: 'Physical location'
            },
            'company': {
                name: 'Company',
                description: 'Requesting organization'
            }
        },

        FILTER_OPTIONS: {
            'assigned_to': {
                name: 'Assigned To',
                description: 'Filter by assignee',
                type: 'user',
                examples: ['javascript:gs.getUserID()', 'admin', 'john.doe']
            },
            'assignment_group': {
                name: 'Assignment Group',
                description: 'Filter by assignment group',
                type: 'reference',
                examples: ['IT Support', 'Network Team', 'Service Desk']
            },
            'state': {
                name: 'State',
                description: 'Current ticket status',
                type: 'choice',
                values: {
                    '1': 'New',
                    '2': 'In Progress',
                    '3': 'On Hold',
                    '4': 'Resolved',
                    '6': 'Resolved',
                    '7': 'Closed',
                    '8': 'Canceled'
                }
            },
            'active': {
                name: 'Active',
                description: 'Whether the record is active',
                type: 'choice',
                values: {
                    'true': 'Active',
                    'false': 'Inactive'
                }
            },
            'priority': {
                name: 'Priority',
                description: 'Business priority level',
                type: 'choice',
                values: {
                    '1': 'Critical',
                    '2': 'High',
                    '3': 'Moderate',
                    '4': 'Low',
                    '5': 'Planning'
                }
            },
            'urgency': {
                name: 'Urgency',
                description: 'Speed of resolution needed',
                type: 'choice',
                values: {
                    '1': 'High',
                    '2': 'Medium',
                    '3': 'Low'
                }
            },
            'impact': {
                name: 'Impact',
                description: 'Business impact level',
                type: 'choice',
                values: {
                    '1': 'High',
                    '2': 'Medium',
                    '3': 'Low'
                }
            },
            'category': {
                name: 'Category',
                description: 'Primary classification',
                type: 'string',
                examples: ['Hardware', 'Software', 'Network', 'Security']
            },
            'caller_id': {
                name: 'Caller',
                description: 'Person who reported the issue',
                type: 'user',
                examples: ['javascript:gs.getUserID()', 'john.doe']
            },
            'opened_at': {
                name: 'Opened Date',
                description: 'When ticket was created',
                type: 'date',
                examples: ['2024-01-01', 'javascript:gs.daysAgoStart(7)']
            },
            'sys_created_on': {
                name: 'Created Date',
                description: 'System creation date',
                type: 'date',
                examples: ['2024-01-01', 'javascript:gs.daysAgoStart(30)']
            },
            'number': {
                name: 'Ticket Number',
                description: 'Specific ticket number',
                type: 'string',
                examples: ['INC0001234', 'REQ0005678']
            },
            'short_description': {
                name: 'Short Description',
                description: 'Search in summary text',
                type: 'string',
                examples: ['password', 'network', 'email']
            }
        },

        THEMES: {
            'wholefoodsGreen': {
                name: 'Whole Foods Green',
                primary: '#004e36',
                secondary: '#006b4a',
                accent: '#00a86b',
                light: '#e8f5f0'
            },
            'servicenowBlue': {
                name: 'ServiceNow Blue',
                primary: '#0073e7',
                secondary: '#0056b3',
                accent: '#4da6ff',
                light: '#e6f3ff'
            },
            'corporateGray': {
                name: 'Corporate Gray',
                primary: '#343a40',
                secondary: '#495057',
                accent: '#6c757d',
                light: '#f8f9fa'
            }
        }
    };

})();