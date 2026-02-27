# Developer Attribution Page

## Purpose

Create a lowkey "Made By" section that can be embedded into userscript UIs, settings panels, or injected page footers. The mark should be subtle, unobtrusive, and consistent across all Tampermonkey projects.

---

## Content

**Developed by:** Ryan Satterfield
**GitHub:** [RynAgain](https://github.com/RynAgain)

---

## Implementation Guidelines

### Placement

- Append to the bottom of any  ssettings modal.
- Use a small, muted font that doesn't distract from the primary interface.
- The mark should be visible but not prominent — think footer-level presence.

### Suggested HTML Snippet

```html
<div id="dev-mark" style="text-align: center; padding: 8px 0; font-size: 11px; color: #888; font-family: sans-serif;">
  Developed by <a href="https://github.com/RynAgain" target="_blank" rel="noopener noreferrer" style="color: #58a6ff; text-decoration: none;">Ryan Satterfield</a>
</div>
```

### Styling Notes

- **Font size:** 11–12px — small enough to stay out of the way.
- **Color:** Muted gray (`#888`) for the text, GitHub-blue (`#58a6ff`) for the link.
- **Hover behavior:** Optionally underline the link on hover for accessibility.
- **Dark mode:** If the host page or UI uses a dark theme, the muted gray and GitHub-blue already work well. No additional adjustments needed unless the background is very dark.

### Reusable JavaScript Helper

For consistency across multiple scripts, use a shared function:

```javascript
function injectDevMark(container) {
  const mark = document.createElement('div');
  mark.id = 'dev-mark';
  mark.style.cssText = 'text-align:center;padding:8px 0;font-size:11px;color:#888;font-family:sans-serif;';
  mark.innerHTML = 'Developed by <a href="https://github.com/RynAgain" target="_blank" rel="noopener noreferrer" style="color:#58a6ff;text-decoration:none;">Ryan Satterfield</a>';
  (container || document.body).appendChild(mark);
}
```

Call it wherever a UI panel is created:

```javascript
injectDevMark(mySettingsPanel);
```

---

## Optional Enhancements

| Feature | Description |
|---|---|
| **Version display** | Append the script version from the Tampermonkey `@version` tag. |
| **Tooltip** | Add a `title` attribute: `title="View source on GitHub"`. |
| **Fade-in** | Use a CSS transition to fade the mark in after the UI loads. |
| **Click tracking** | Log a console message when the link is clicked (debug only). |

---

## Notes

- Keep it consistent — every script that ships a visible UI should include this mark.
- Do **not** add the mark to scripts that run silently with no UI presence.
- The mark is informational, not a license notice. Licensing details belong in the script header or a separate `LICENSE` file.
