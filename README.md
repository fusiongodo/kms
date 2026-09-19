# Local page

A local block editor for one Ubuntu machine. Pages live in this browser via IndexedDB. There is no server and no sync.

Stack: Vite + Svelte, a custom ProseMirror schema, Yjs + y-prosemirror, y-indexeddb.

## Run

```bash
npm install
npm run dev
```

Opens on `http://127.0.0.1:45217`. Reload keeps every page.

## Editing

The first block is the page heading. Every paragraph, heading, list item, toggle, and page link is an element with a stable `id`.

- `/h1` `/h2` `/h3` — headings, also via the `/` menu
- `/tog` — nestable toggle; children stay in the document when collapsed
- `/page` — create a clickable page element; click opens that page
- Alt+← — go back to the previous page (same as the browser back stack)
- `- ` — bullet list
- Tab / Shift+Tab — nest lists, nest a block into the previous toggle, or lift out
- Enter — new element; original keeps its id, the new block gets a new one
- Shift+Enter — line break inside the same element
- Backspace at the start of a block — merge; the surviving element keeps its id
- Ctrl+B / Ctrl+I — bold / italic
- Ctrl+Z / Ctrl+Y — Yjs UndoManager (not prosemirror-history)

## Pages

Each page is its own Yjs document in IndexedDB (`page-<id>`). A local catalog stores titles. The URL hash is `#/p/<id>`, so refresh stays on the same page. `/page` always creates a new page; the link label follows that page’s heading.

## Not in this slice

Search, history UI, paste links/images, theme, sidebar, spaces, and any network sync.

## Schema notes

Toggles are `toggle > toggle_title + toggle_body`. Nesting is real child nodes. `collapsed` is an attribute on the same node, so children are not dropped when the toggle is closed.

Page links are atom `page_link` nodes with a `pageId`. Click (or Enter when selected) navigates.

IDs are attributes on the element nodes. Split assigns a new id to the new element. Merge keeps the first element's id.
