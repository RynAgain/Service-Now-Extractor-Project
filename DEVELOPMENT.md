# Development Guide - ServiceNow Extractor Modular Version

## 🚀 Quick Start for Development

### Setting Up the Modular Version

1. **Update File Paths**: Edit [`main.js`](main.js) and update the `@require` paths to match your system:
   ```javascript
   // Change this:
   // @require file://C:/Source/Service-Now-Extractor-Project/modules/config.js
   
   // To your actual path:
   // @require file://C:/Your/Actual/Path/Service-Now-Extractor-Project/modules/config.js
   ```

2. **Install in Tampermonkey**: Copy the contents of [`main.js`](main.js) into a new Tampermonkey script

3. **Enable File Access**: In Tampermonkey settings, ensure file access is enabled for local files

## 🔧 Common Development Tasks

### Adding a New Field

1. **Update Configuration** ([`modules/config.js`](modules/config.js)):
   ```javascript
   AVAILABLE_FIELDS: {
       'your_new_field': {
           name: 'Your New Field',
           description: 'Description of what this field contains'
       }
   }
   ```

2. **Add Filter Support** (if needed):
   ```javascript
   FILTER_OPTIONS: {
       'your_new_field': {
           name: 'Your New Field',
           description: 'Filter by your new field',
           type: 'string', // or 'choice', 'date', 'user', 'reference'
           examples: ['example1', 'example2']
       }
   }
   ```

### Adding a New ServiceNow Table

1. **Update Configuration** ([`modules/config.js`](modules/config.js)):
   ```javascript
   AVAILABLE_TABLES: {
       'your_table': {
           name: 'Your Table Name',
           description: 'Description of what this table contains'
       }
   }
   ```

2. **Test API Access**: The API module should automatically handle new tables, but test to ensure the ServiceNow instance allows access.

### Customizing the UI

1. **Modify Themes** ([`modules/config.js`](modules/config.js)):
   ```javascript
   THEMES: {
       'yourTheme': {
           name: 'Your Theme Name',
           primary: '#your-primary-color',
           secondary: '#your-secondary-color',
           accent: '#your-accent-color',
           light: '#your-light-color'
       }
   }
   ```

2. **Update UI Components** ([`modules/ui.js`](modules/ui.js)):
   - Modify `createUIHTML()` for layout changes
   - Update individual list functions for content changes

### Adding New Export Features

1. **Extend Excel Module** ([`modules/excel.js`](modules/excel.js)):
   ```javascript
   // Add new export method
   exportCustomFormat: function(tickets, options) {
       // Your custom export logic
   }
   ```

2. **Add UI Controls** ([`modules/ui.js`](modules/ui.js)):
   ```javascript
   // Add button to UI HTML
   <button id="export-custom">Export Custom Format</button>
   ```

3. **Wire Up Events** ([`modules/events.js`](modules/events.js)):
   ```javascript
   // Add event binding
   this.bindElement('export-custom', 'click', this.exportCustom);
   ```

## 🐛 Debugging Tips

### Module Loading Issues

1. **Check Console**: Look for module loading errors in browser console
2. **Verify Paths**: Ensure all `@require` paths are correct and accessible
3. **Test Individual Modules**: Load modules one by one to isolate issues

### Runtime Debugging

1. **Use Browser DevTools**: Set breakpoints in individual modules
2. **Check Global Objects**: Verify `window.SNExtractor*` objects are available:
   ```javascript
   console.log(window.SNExtractorConfig);
   console.log(window.SNExtractorMain);
   ```

3. **Monitor Network**: Check ServiceNow API calls in Network tab

### Common Issues and Solutions

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| "Module not found" | Incorrect file path | Update `@require` paths in main.js |
| "Function not defined" | Module loading order | Check module dependencies |
| "API calls failing" | ServiceNow permissions | Check user permissions and session |
| "UI not updating" | Event binding issues | Check event handlers in events.js |

## 📊 Performance Optimization

### Best Practices

1. **Lazy Loading**: Only load data when needed
2. **Debounce Events**: Use `utils.debounce()` for frequent events
3. **Batch Operations**: Group API calls when possible
4. **Memory Management**: Clear large datasets when not needed

### Monitoring Performance

```javascript
// Use built-in timing functions
const startTime = window.SNExtractorUtils.startTimer('extraction');
// ... your code ...
window.SNExtractorUtils.endTimer('extraction', startTime);
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] UI loads correctly on ServiceNow pages
- [ ] All tabs function properly
- [ ] Current page extraction works on list views
- [ ] Current page extraction works on form views
- [ ] API extraction works with filters
- [ ] Excel export generates valid files
- [ ] Settings persist between sessions
- [ ] Drag and drop functionality works
- [ ] Keyboard shortcuts respond
- [ ] Theme switching works

### Test Data Sources

1. **ServiceNow Demo Instance**: Use for testing without affecting production
2. **Different Page Types**: Test on various ServiceNow page layouts
3. **Different Data Volumes**: Test with small and large datasets
4. **Different Browsers**: Ensure compatibility across browsers

## 🔄 Module Communication

### How Modules Interact

```
main.js (Coordinator)
├── Loads all modules via @require
├── Manages application state
├── Coordinates module interactions
└── Provides public API

events.js ←→ main.js ←→ ui.js
    ↓           ↓         ↓
utils.js ←→ extractor.js ←→ api.js
    ↓           ↓         ↓
storage.js ←→ excel.js ←→ config.js
```

### Adding Module Dependencies

If you create a new module that depends on others:

1. **Load Order**: Ensure dependencies are loaded first in `main.js`
2. **Check Availability**: Always check if dependent modules exist:
   ```javascript
   if (window.SNExtractorUtils) {
       // Use the module
   }
   ```

## 📝 Code Style Guidelines

### Naming Conventions
- **Global Objects**: `window.SNExtractor[ModuleName]`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private Functions**: Prefix with underscore `_privateFunction`

### Error Handling
```javascript
try {
    // Your code
} catch (error) {
    console.error('Module Name: Operation failed:', error);
    if (window.SNExtractorUtils) {
        window.SNExtractorUtils.updateStatus('❌ Operation failed');
    }
}
```

### Documentation
- Add JSDoc comments for public functions
- Include usage examples for complex functions
- Document module dependencies

## 🚢 Deployment

### For Development
1. Use the modular version with local file `@require` statements
2. Edit individual modules as needed
3. Test changes immediately

### For Production/Distribution
1. Consider combining modules into a single file for easier distribution
2. Minify code if needed
3. Update version numbers in all relevant files

## 🤝 Contributing

### Before Making Changes
1. Understand which module(s) your change affects
2. Check for breaking changes to module interfaces
3. Update documentation if adding new features
4. Test thoroughly across different scenarios

### Submitting Changes
1. Test the modular version works correctly
2. Ensure the original [`MainScript.js`](MainScript.js) is updated if needed
3. Update version numbers appropriately
4. Document any new dependencies or requirements

---

Happy coding! The modular structure makes the codebase much more maintainable and extensible. 🎉