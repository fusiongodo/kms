<script lang="ts">
  import type { EditorView } from 'prosemirror-view'
  import type { XmlFragment } from 'yjs'
  import { createEditorView } from '../editor/createEditor'
  import {
    filterSlashItems,
    slashKey,
    type SlashItem,
    type SlashState,
  } from '../editor/slash'

  let { fragment }: { fragment: XmlFragment } = $props()

  let view: EditorView | undefined
  let slash: SlashState | undefined = $state()
  let menuPos = $state({ top: 0, left: 0 })

  const items = $derived(slash?.active ? filterSlashItems(slash.query) : [])

  function syncSlash(next: EditorView) {
    slash = slashKey.getState(next.state)
    if (slash?.active) {
      const coords = next.coordsAtPos(slash.from)
      menuPos = { top: coords.bottom + 6, left: coords.left }
    }
  }

  function pick(item: SlashItem) {
    if (!view || !slash?.active) return
    item.run(view, slash.from, slash.to)
    syncSlash(view)
  }

  function mountEditor(node: HTMLDivElement) {
    const next = createEditorView(node, fragment)
    view = next
    const original = next.dispatch.bind(next)
    next.dispatch = (tr) => {
      original(tr)
      syncSlash(next)
    }
    syncSlash(next)
    next.focus()
    return {
      destroy() {
        if (view === next) view = undefined
        next.destroy()
      },
    }
  }
</script>

<div class="editor-shell">
  <div class="editor-mount" use:mountEditor></div>
</div>

{#if slash?.active}
  <div
    class="slash-menu"
    style="top: {menuPos.top}px; left: {menuPos.left}px"
    role="listbox"
    aria-label="Block types"
  >
    {#if items.length === 0}
      <div class="slash-empty">No matching blocks</div>
    {:else}
      {#each items as item, i (item.id)}
        <button
          type="button"
          class="slash-item"
          class:is-active={i === slash.index}
          role="option"
          aria-selected={i === slash.index}
          onmousedown={(event) => event.preventDefault()}
          onclick={() => pick(item)}
        >
          <span class="slash-label">{item.label}</span>
          <span class="slash-hint">{item.hint}</span>
        </button>
      {/each}
    {/if}
  </div>
{/if}
