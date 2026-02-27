# Toolbox Architecture — Design Guide

> A generalized reference for the toolbar/tool registry pattern used in DashCam QueryBooster.  
> Use this document when adding new tools, modifying the toolbar, or adapting the pattern to other projects.

---

## 1. Core Concept

The toolbar is a **registry-driven UI** — tools are defined as data, not hardcoded DOM. A central `TOOLBAR_TOOLS` array describes every tool. The renderer (`createToolbar()`) iterates the array, skips disabled tools, and creates buttons. Adding a new tool means adding one object to the array and implementing its handler function.

```
┌──────────────────────────────────────────────────────────┐
│  TOOLBAR_TOOLS (data)                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Analyzer│ │ Comment │ │  Ref    │ │ Format  │  ...   │
│  │ id/icon │ │ id/icon │ │ id/icon │ │ id/icon │        │
│  │ handler │ │ handler │ │ handler │ │ handler │        │
│  │ flag    │ │ flag    │ │ flag    │ │ flag    │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼
             createToolbar() — renderer
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│  #dashcam-toolbar (DOM)                                   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌──┐               │
│  │ 📷 │ │ 🐛 │ │ 💬 │ │ 📖 │ │ ✨ │ │›│               │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └──┘               │
│  toggle  Anlz   Cmt    Ref    Fmt   collapse             │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Tool Registry Schema

Each tool in `TOOLBAR_TOOLS` is an object with these properties:

| Property      | Type              | Required | Description |
|---------------|-------------------|----------|-------------|
| `id`          | `string`          | ✅       | Unique identifier. Used for DOM ID (`dashcam-tool-{id}`), CSS hooks, and enable/disable logic. |
| `icon`        | `string`          | ✅       | Google Material Icons name (e.g., `'bug_report'`, `'comment'`, `'auto_fix_high'`). |
| `label`       | `string`          | ✅       | Tooltip text shown on hover. Include keyboard shortcuts here if applicable. |
| `handler`     | `() => void`      | ✅       | Function called on button click. Should be a zero-arg callback. |
| `featureFlag` | `string \| null`  | ✅       | Key in `FEATURE_FLAGS`. If the flag is `false`, the tool button is not rendered. Use `null` for always-enabled tools. |

### Example Entry

```javascript
{
    id: 'my-new-tool',
    icon: 'build',
    label: 'My New Tool',
    handler: () => myNewToolFunction(),
    featureFlag: 'MY_NEW_TOOL'
}
```

---

## 3. Feature Flags

Feature flags control which tools are rendered in the toolbar and which code paths are active. They live in a single `FEATURE_FLAGS` object at the top of the IIFE.

```javascript
const FEATURE_FLAGS = {
    INLINE_ANNOTATIONS: true,
    TOOLBAR: true,
    COMMENT_TOGGLE: true,
    SYNTAX_REFERENCE: true,
    SQL_FORMATTER: true,
    SNIPPET_LIBRARY: true,
    // Add new flags here:
    MY_NEW_TOOL: false  // disabled by default, enable for testing
};
```

### Design Rules

1. **New tools ship disabled** (`false`) until tested and validated.
2. **`null` featureFlag** means always enabled — reserved for the primary tool (SQL Analyzer).
3. **Feature-gated code** should check `if (!FEATURE_FLAGS.MY_FLAG) return;` at the top of its entry function.
4. **Toolbar itself** is behind `FEATURE_FLAGS.TOOLBAR` — when `false`, falls back to a legacy single button.

---

## 4. Toolbar Lifecycle

```
initialize()
    └── updateButtonVisibility()
            ├── shouldShowButton() → false → removeAnalysisButton()
            └── shouldShowButton() → true  → createAnalysisButton()
                                                ├── TOOLBAR=true  → createToolbar()
                                                └── TOOLBAR=false → _createLegacyButton()
```

### States

| State       | DOM                              | Description |
|-------------|----------------------------------|-------------|
| **Hidden**  | No toolbar in DOM                | Page too small, iframe, or no content detected |
| **Collapsed** | Toggle button only visible     | Default state — minimal footprint on host page |
| **Expanded**  | All tool buttons visible       | User clicked toggle to expand |

### Transitions

- **Hidden → Collapsed**: `createToolbar()` called by `updateButtonVisibility()`
- **Collapsed → Expanded**: User clicks the toggle button (camera icon)
- **Expanded → Collapsed**: User clicks the collapse chevron (`›`)
- **Any → Hidden**: `removeAnalysisButton()` called — cleans up DOM + drag listeners

---

## 5. Adding a New Tool — Checklist

### Step 1: Define the Feature Flag

```javascript
const FEATURE_FLAGS = {
    // ... existing flags ...
    MY_NEW_TOOL: false  // start disabled
};
```

### Step 2: Implement the Handler Function

Write the tool's core logic as a standalone function. Keep DOM creation and business logic separate when possible (pure functions + UI renderers).

```javascript
// Pure logic (testable)
function myToolLogic(input) {
    // ... returns result ...
}

// UI entry point (DOM-dependent)
function myNewToolFunction() {
    if (!FEATURE_FLAGS.MY_NEW_TOOL) return;
    
    // Toggle panel, show modal, modify editor, etc.
}
```

### Step 3: Register in TOOLBAR_TOOLS

Add the entry to the array. Position determines button order (left to right).

```javascript
const TOOLBAR_TOOLS = [
    // ... existing tools ...
    {
        id: 'my-new-tool',
        icon: 'build',
        label: 'My New Tool',
        handler: () => myNewToolFunction(),
        featureFlag: 'MY_NEW_TOOL'
    }
];
```

### Step 4: Add Enable/Disable Logic (optional)

If the tool should be dimmed/disabled based on context (e.g., no SQL detected, no editor), add logic to `_updateToolbarButtonStates()`:

```javascript
const myBtn = document.getElementById('dashcam-tool-my-new-tool');
if (myBtn) {
    if (someCondition) {
        myBtn.classList.remove('dashcam-tool-btn--disabled');
    } else {
        myBtn.classList.add('dashcam-tool-btn--disabled');
    }
}
```

### Step 5: Add CSS (if tool has a panel)

Follow the naming convention: `dashcam-{toolname}-*`. Add styles inside `injectStyles()`.

### Step 6: Add MutationObserver Exclusion

If the tool creates DOM elements, add their IDs/classes to the MutationObserver ignore list in `initialize()` to prevent infinite re-scan loops.

### Step 7: Write Unit Tests

Follow the existing test pattern (source scanning + behavioral tests for pure functions):

```javascript
// tests/my-new-tool.test.mjs
describe('My New Tool — Function definitions', () => {
    it('should define myNewToolFunction()', () => { ... });
    it('should define myToolLogic()', () => { ... });
});

describe('My New Tool — myToolLogic() behavioral', () => {
    it('should handle basic input', () => { ... });
});

describe('Regression — Core functions still defined', () => {
    // Verify all existing functions still present
});
```

### Step 8: Enable the Flag

Once tested, set the flag to `true`:

```javascript
MY_NEW_TOOL: true
```

---

## 6. Tool UI Patterns

The project uses several recurring UI patterns. Choose the right one for your tool:

### Pattern A: Inline Editor Action

**Used by:** SQL Formatter, Comment Toggle  
**Behavior:** Reads from editor, transforms, writes back.  
**No panel needed.** Operates directly on editor content via `EditorAdapter`.

```
User clicks button → read editor content → transform → write back → show toast
```

**Key APIs:**
- `EditorAdapter.getValue()` / `EditorAdapter.getSelection()`
- `EditorAdapter.replaceContent()` / `EditorAdapter.replaceSelectionRange()`
- `showToast()` for feedback

**Revert pattern:** Save snapshot before modification, offer undo via toast action button.

### Pattern B: Panel with Static Content

**Used by:** Syntax Reference, Issues Panel  
**Behavior:** Opens a draggable panel with reference data, search, and accordion categories.

```
User clicks button → toggle panel → render content → search/filter
```

**Key APIs:**
- `makeDraggable(panel, header)` for drag support
- Accordion toggle via `.expanded` CSS class
- Close on Escape key + close button

### Pattern C: Panel with Interactive Builder

**Used by:** Snippet Library (with Query Builder)  
**Behavior:** Panel with form inputs that generate output.

```
User clicks button → toggle panel → populate from data store → live preview → insert/copy
```

**Key APIs:**
- `RecentTablesStore.load()` for data
- `buildQueryFromSelections()` for generation
- `EditorAdapter.replaceSelection()` for insertion

### Pattern D: Modal Overlay

**Used by:** AI Optimization Modal  
**Behavior:** Full overlay with content, draggable header, close on Escape.

```
User clicks button → show overlay → fetch data → display → close
```

---

## 7. EditorAdapter API

All editor interactions go through `EditorAdapter`, which abstracts CodeMirror and Ace editor APIs:

| Method                       | Returns   | Description |
|------------------------------|-----------|-------------|
| `getCodeMirrorInstance()`    | CM / null | Returns CodeMirror instance if available |
| `getAceInstance()`           | Ace / null| Returns Ace editor instance if available |
| `getValue()`                 | string    | Gets full editor content |
| `getSelection()`             | string    | Gets selected text |
| `hasSelection()`             | boolean   | True if text is selected |
| `replaceContent(text)`       | boolean   | Replaces all content (undo-safe) |
| `replaceSelection(text)`     | boolean   | Inserts text at cursor |
| `replaceSelectionRange(text)` | boolean  | Replaces selection (undo-safe) |
| `getCursorPosition()`        | {line, ch}| Returns cursor position |

**Undo safety:** `replaceContent` and `replaceSelectionRange` wrap operations in undo transactions (CodeMirror `cm.operation()`, Ace undo groups).

---

## 8. CSS Naming Convention

All classes and IDs use the `dashcam-` prefix to avoid collisions with host site styles.

| Element Type        | Pattern                          | Example |
|---------------------|----------------------------------|---------|
| Toolbar container   | `#dashcam-toolbar`               | |
| Tool button         | `.dashcam-tool-btn`              | |
| Tool button ID      | `#dashcam-tool-{id}`             | `#dashcam-tool-sql-formatter` |
| Panel               | `#dashcam-{tool}-panel`          | `#dashcam-snippet-panel` |
| Panel header        | `.dashcam-panel-header`          | |
| Internal section    | `.dashcam-{tool}-{element}`      | `.dashcam-syntax-search` |
| State classes       | `.dashcam-{base}--{state}`       | `.dashcam-tool-btn--disabled` |

**All CSS uses `!important`** to override host site styles. CSS custom properties (`--dc-*`) control the theme.

---

## 9. Testing Strategy

### Three Layers

1. **Source scanning** — Verify functions, variables, CSS classes exist in the source file via regex/string matching.
2. **Behavioral tests** — Extract pure functions via `eval()` and test actual input → output.
3. **Regression tests** — Verify all existing functions, flags, and structures remain intact.

### Extracting Pure Functions for Testing

Since the codebase is an IIFE, pure functions are extracted for testing:

```javascript
function getMyPureFunction() {
    const fnStart = source.indexOf('function myPureFunction(');
    const fnEnd = source.indexOf('function nextFunction(', fnStart);
    let endBrace = fnEnd - 1;
    while (endBrace > fnStart && source[endBrace] !== '}') endBrace--;
    endBrace++;
    const fnBody = source.substring(fnStart, endBrace);
    return eval(`(function() { ${fnBody}\n return myPureFunction; })()`);
}
```

### Test File Convention

- One test file per tool: `tests/{tool-name}.test.mjs`
- Uses Node.js built-in test runner: `import { describe, it } from 'node:test'`
- All tests runnable via: `node --test tests/*.test.mjs`

---

## 10. Data Flow Architecture

```
┌─────────────────────────────────────────────────┐
│                 initialize()                      │
│  ┌─────────────────────────────────────────────┐ │
│  │ MutationObserver — watches for DOM changes  │ │
│  │ (ignores dashcam-* elements)                │ │
│  └─────────────────────────────────────────────┘ │
│                      │                            │
│                      ▼                            │
│         updateButtonVisibility()                  │
│         ├── detectSQLContent()                    │
│         ├── createToolbar() or removeToolbar()    │
│         └── _updateToolbarButtonStates()          │
└─────────────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │SQL       │  │ Comment  │  │ Syntax   │
   │Analyzer  │  │ Toggle   │  │Reference │
   │          │  │          │  │          │
   │runSQL    │  │toggleCmt │  │showSyntax│
   │Analysis()│  │OnSelect()│  │Reference│
   └──────────┘  └──────────┘  └──────────┘
         │                           │
         ▼                           ▼
   ┌──────────┐              ┌──────────┐
   │ Issues   │              │ Dialect  │
   │ Panel    │              │ Tabs     │
   │ + Gutter │              │ (RS/Spark│
   │ Markers  │              │  SQL)    │
   └──────────┘              └──────────┘
         │
         ▼
   ┌──────────┐
   │ AI Modal │
   │callAPI() │
   └──────────┘

   ┌──────────┐  ┌──────────┐
   │ SQL      │  │ Snippet  │
   │Formatter │  │ Library  │
   │          │  │          │
   │formatSQL │  │showSnippet│
   │String()  │  │Library() │
   │+ revert  │  │+ Query   │
   │          │  │  Builder │
   └──────────┘  └──────────┘
```

---

## 11. Toast Notification System

`showToast(message, type, duration, action)` provides user feedback:

| Parameter  | Type                                    | Default  | Description |
|------------|-----------------------------------------|----------|-------------|
| `message`  | `string`                                | required | Text to display |
| `type`     | `'info' \| 'warning' \| 'error' \| 'success'` | `'info'` | Icon and style |
| `duration` | `number`                                | `3000`   | Auto-dismiss in ms |
| `action`   | `{label, icon?, callback}` \| `null`    | `null`   | Optional clickable button |

When `action` is provided, the toast gets `pointer-events: auto` and renders a button that calls `action.callback` on click.

**Use case:** The SQL Formatter shows `showToast('SQL formatted', 'success', 5000, { label: 'Undo', icon: 'undo', callback: () => revertFormatSQL() })`.

---

## 12. Shared State Management

| Variable                     | Scope        | Purpose |
|------------------------------|--------------|---------|
| `_dashcamAceDecorations`     | IIFE-scoped  | Ace editor gutter decorations |
| `_dashcamLastLineIssueMap`   | IIFE-scoped  | Last computed line→issue mapping |
| `_formatSQLSnapshot`         | IIFE-scoped  | Pre-format editor content for revert |
| `_syntaxDialectSelection`    | IIFE-scoped  | Last selected syntax dialect |
| `toolbarElement`             | IIFE-scoped  | Reference to toolbar DOM element |
| `toolbarExpanded`            | IIFE-scoped  | Boolean — is toolbar expanded? |
| `RecentTablesStore`          | IIFE-scoped  | localStorage-backed table history |

**Rule:** No globals. All state lives inside the IIFE. Use `let` for mutable state, `const` for immutable.

---

## 13. Future Tool Ideas

These are documented for future reference. Each would follow the same pattern: flag → registry entry → handler → tests.

| Tool | Icon | Pattern | Description |
|------|------|---------|-------------|
| Execution Plan Estimator | `speed` | Modal (D) | Prepend EXPLAIN, send to AI, display analysis |
| Column Profiler | `analytics` | Panel (B) | Show column stats from query results |
| Schema Browser | `account_tree` | Panel (C) | Browse schemas/tables/columns from metadata |
| Query History | `history` | Panel (B) | localStorage-backed query execution history |
| Diff Viewer | `compare` | Panel (B) | Compare current SQL with formatted/previous version |
| Keyboard Shortcuts | `keyboard` | Modal (D) | Display all available keyboard shortcuts |

---

## Summary

The toolbox pattern reduces the cost of adding new tools to:

1. **One data entry** in `TOOLBAR_TOOLS`
2. **One feature flag** in `FEATURE_FLAGS`  
3. **One handler function** (plus any pure logic functions)
4. **One test file** following the established pattern

Everything else — button rendering, enable/disable states, collapsed/expanded transitions, icon rendering, DOM cleanup — is handled automatically by the toolbar infrastructure.
