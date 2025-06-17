# ServiceNow Ticket Data Extractor - Modular Version

A modularized Tampermonkey script for extracting ServiceNow ticket data to Excel format. This version breaks down the original monolithic script into logical, maintainable modules.

## 📁 Project Structure

```
Service-Now-Extractor-Project/
├── main.js                    # Main script that requires all modules
├── MainScript.js             # Original monolithic script (for reference)
├── modules/
│   ├── config.js             # Configuration constants and settings
│   ├── storage.js            # Settings management (load/save)
│   ├── api.js                # ServiceNow API calls and data fetching
│   ├── ui.js                 # UI creation and HTML generation
│   ├── events.js             # Event handlers and user interactions
│   ├── extractor.js          # Data extraction logic (current page and API)
│   ├── excel.js              # Excel export functionality
│   └── utils.js              # Utility functions and helpers
└── README.md                 # This documentation
```

## 🧩 Module Breakdown

### 1. **config.js** - Configuration Module
- **Purpose**: Centralized configuration constants
- **Contains**: 
  - Available ServiceNow tables (incidents, requests, etc.)
  - Field definitions and descriptions
  - Filter options and validation rules
  - UI themes and color schemes
- **Global Object**: `window.SNExtractorConfig`

### 2. **storage.js** - Storage Management Module
- **Purpose**: Handle settings persistence using Tampermonkey's GM_setValue/GM_getValue
- **Contains**:
  - Load/save settings functions
  - Default configuration values
  - Error handling for storage operations
- **Global Object**: `window.SNExtractorStorage`

### 3. **utils.js** - Utility Functions Module
- **Purpose**: Common utility functions used across modules
- **Contains**:
  - User info detection
  - Page type detection
  - Data cleaning and validation
  - Theme color management
  - Status updates and logging
- **Global Object**: `window.SNExtractorUtils`

### 4. **api.js** - API Communication Module
- **Purpose**: Handle all ServiceNow API interactions
- **Contains**:
  - REST API calls with timeout handling
  - Multiple fallback methods for data retrieval
  - Query string building from filters
  - Error handling and retry logic
- **Global Object**: `window.SNExtractorAPI`

### 5. **extractor.js** - Data Extraction Module
- **Purpose**: Extract ticket data from current page or API
- **Contains**:
  - List view extraction (table parsing)
  - Form view extraction (field detection)
  - Enhanced extraction with better field mapping
  - Data validation and cleaning
- **Global Object**: `window.SNExtractorData`

### 6. **excel.js** - Excel Export Module
- **Purpose**: Generate and export Excel files
- **Contains**:
  - Single and multi-sheet workbook creation
  - Data formatting and styling
  - Summary statistics generation
  - Column auto-sizing
- **Global Object**: `window.SNExtractorExcel`

### 7. **ui.js** - User Interface Module
- **Purpose**: Create and manage the user interface
- **Contains**:
  - HTML generation for all UI components
  - Dynamic list updates (fields, tables, filters)
  - Tab switching and modal management
  - Theme-aware styling
- **Global Object**: `window.SNExtractorUI`

### 8. **events.js** - Event Handling Module
- **Purpose**: Manage all user interactions and events
- **Contains**:
  - Event binding and delegation
  - Drag and drop functionality
  - Keyboard shortcuts
  - Context menu creation
  - Global function setup for inline handlers
- **Global Object**: `window.SNExtractorEvents`

### 9. **main.js** - Main Coordination Module
- **Purpose**: Orchestrate all modules and manage application state
- **Contains**:
  - Application initialization
  - State management (tickets, settings, filters)
  - Module coordination
  - Public API for module interactions
- **Global Object**: `window.SNExtractorMain`

## 🚀 Installation & Usage

### Option 1: Use the Modular Version (Recommended for Development)

1. **Install the main script** in Tampermonkey:
   ```javascript
   // Copy the contents of main.js into a new Tampermonkey script
   ```

2. **Update file paths** in the `@require` directives to match your local setup:
   ```javascript
   // @require file://C:/Your/Path/To/Service-Now-Extractor-Project/modules/config.js
   // @require file://C:/Your/Path/To/Service-Now-Extractor-Project/modules/storage.js
   // ... etc
   ```

3. **Enable the script** and navigate to your ServiceNow instance

### Option 2: Use the Original Monolithic Script

1. **Install MainScript.js** directly in Tampermonkey if you prefer the single-file approach

## 🔧 Development Benefits

### Maintainability
- **Separation of Concerns**: Each module has a single responsibility
- **Easier Debugging**: Issues can be isolated to specific modules
- **Code Reusability**: Modules can be reused in other projects

### Readability
- **Logical Organization**: Related functionality is grouped together
- **Smaller Files**: Each module is focused and manageable
- **Clear Dependencies**: Module interactions are explicit

### Extensibility
- **Easy to Add Features**: New functionality can be added as separate modules
- **Plugin Architecture**: Modules can be swapped or extended independently
- **Testing**: Individual modules can be tested in isolation

## 🛠️ Customization

### Adding New Fields
1. Update `config.js` → `AVAILABLE_FIELDS` object
2. Add filter options in `config.js` → `FILTER_OPTIONS` if needed
3. Update extraction logic in `extractor.js` if special handling is required

### Adding New Tables
1. Update `config.js` → `AVAILABLE_TABLES` object
2. Test API endpoints in `api.js` if needed

### Adding New Themes
1. Update `config.js` → `THEMES` object
2. Colors will automatically apply throughout the UI

### Custom Export Formats
1. Extend `excel.js` with new export methods
2. Add UI controls in `ui.js`
3. Wire up events in `events.js`

## 🐛 Debugging

### Module Loading Issues
- Check browser console for module loading errors
- Verify file paths in `@require` directives
- Ensure all modules are accessible

### Runtime Errors
- Each module logs to console with prefixed messages
- Check `window.SNExtractor*` objects are available
- Use browser debugger to step through module interactions

### Performance Issues
- Monitor network requests in browser dev tools
- Check for memory leaks in long-running sessions
- Use the built-in performance timing in `utils.js`

## 📊 Features

### Data Extraction
- ✅ Current page extraction (list and form views)
- ✅ API-based extraction with filters
- ✅ Multiple table support
- ✅ Duplicate detection and removal
- ✅ Enhanced field detection

### User Interface
- ✅ Draggable, resizable interface
- ✅ Multiple themes
- ✅ Tabbed organization
- ✅ Keyboard shortcuts
- ✅ Context menus

### Export Options
- ✅ Excel export with formatting
- ✅ Multi-sheet workbooks
- ✅ Summary statistics
- ✅ Custom field selection

### Advanced Features
- ✅ Batch extraction
- ✅ Data validation
- ✅ Performance monitoring
- ✅ Error recovery

## 🤝 Contributing

When making changes:

1. **Identify the appropriate module** for your changes
2. **Update related modules** if interfaces change
3. **Test thoroughly** across different ServiceNow pages
4. **Update documentation** if adding new features

## 📝 Version History

- **v4.0**: Modular architecture implementation
- **v3.3**: Original monolithic version (see MainScript.js)

## ⚠️ Notes

- File paths in `@require` directives must be absolute paths
- Tampermonkey must have file access permissions enabled
- Some browsers may require additional security settings for local file access
- The modular version has the same functionality as the original but with better organization

## 🔗 Dependencies

- **XLSX.js**: For Excel file generation
- **Tampermonkey**: For userscript execution and storage
- **ServiceNow**: Target platform (tested on wfmprod.service-now.com)