# Stylesheet organization

The existing Supportly visual system remains in the root `styles.css` so GitHub Pages can load the same stylesheet from every static route without a build step. This folder is reserved for future split files (`global.css`, `components.css`, `layout.css`, `responsive.css`, and `themes.css`) when a bundler or CSS build pipeline is introduced.

No alternate design system is loaded here; this keeps the current UI identity intact.
