<script lang="ts">
  import type { EditorView } from 'prosemirror-view'
  import type { XmlFragment } from 'yjs'
  import { createEditorView } from '../editor/createEditor'
  import type { EditorHooks } from '../editor/hooks'
  import {
    insertPageMention,
    matchingPages,
    mentionKey,
    type MentionState,
  } from '../editor/mention'
  import {
    filterSlashItems,
    slashKey,
    type SlashItem,
    type SlashState,
  } from '../editor/slash'
  import type { PageMeta } from '../pages/workspace'

  let {
    fragment,
    hooks,
  }: {
    fragment: XmlFragment
    hooks: EditorHooks
  } = $props()

  let view: EditorView | undefined
  let slash: SlashState | undefined = $state()
  let mention: MentionState | undefined = $state()
  let menuPos = $state({ top: 0, left: 0 })

  const slashItems = $derived(slash?.active && !mention?.active ? filterSlashItems(slash.query) : [])
  const pageItems = $derived(mention?.active ? matchingPages(mention.query, hooks.pageId) : [])

  function syncMenus(next: EditorView) {
    slash = slashKey.getState(next.state)
    mention = mentionKey.getState(next.state)
    const pos = mention?.active ? mention.from : slash?.active ? slash.from : null
    if (pos != null) {
      const coords = next.coordsAtPos(pos)
      menuPos = { top: coords.bottom + 6, left: coords.left }
    }
  }

  function pickSlash(item: SlashItem) {
    if (!view || !slash?.active) return
    item.run(view, slash.from, slash.to)
    syncMenus(view)
  }

  function pickPage(page: PageMeta) {
    if (!view || !mention?.active) return
    insertPageMention(view, mention.from, mention.to, page)
    syncMenus(view)
  }

  function mountEditor(node: HTMLDivElement) {
    const next = createEditorView(node, fragment, hooks)
    view = next
    const original = next.dispatch.bind(next)
    next.dispatch = (tr) => {
      original(tr)
      syncMenus(next)
    }
    syncMenus(next)
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

{#if mention?.active}
  <div
    class="slash-menu"
    style="top: {menuPos.top}px; left: {menuPos.left}px"
    role="listbox"
    aria-label="Pages"
  >
    {#if pageItems.length === 0}
      <div class="slash-empty">No matching pages</div>
    {:else}
      {#each pageItems as page, i (page.id)}
        <button
          type="button"
          class="slash-item"
          class:is-active={i === mention.index}
          role="option"
          aria-selected={i === mention.index}
          onmousedown={(event) => event.preventDefault()}
          onclick={() => pickPage(page)}
        >
          <span class="slash-label">{page.title}</span>
          <span class="slash-hint">+</span>
        </button>
      {/each}
    {/if}
  </div>
{:else if slash?.active}
  <div
    class="slash-menu"
    style="top: {menuPos.top}px; left: {menuPos.left}px"
    role="listbox"
    aria-label="Block types"
  >
    {#if slashItems.length === 0}
      <div class="slash-empty">No matching blocks</div>
    {:else}
      {#each slashItems as item, i (item.id)}
        <button
          type="button"
          class="slash-item"
          class:is-active={i === slash.index}
          role="option"
          aria-selected={i === slash.index}
          onmousedown={(event) => event.preventDefault()}
          onclick={() => pickSlash(item)}
        >
          <span class="slash-label">{item.label}</span>
          <span class="slash-hint">{item.hint}</span>
        </button>
      {/each}
    {/if}
  </div>
{/if}
