<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import Editor from './lib/Editor.svelte'
  import { openLocalDoc, type LocalDoc } from './editor/persist'

  let doc = $state<LocalDoc | undefined>()
  let ready = $state(false)
  let titleEl = $state<HTMLElement | undefined>()
  let persisted = $state(false)
  let error = $state<string | null>(null)

  function writeTitle(text: string) {
    if (!doc) return
    const current = doc.title.toString()
    if (current === text) return
    doc.ydoc.transact(() => {
      doc!.title.delete(0, doc!.title.length)
      if (text) doc!.title.insert(0, text)
    })
  }

  function bindTitle() {
    if (!doc || !titleEl) return
    const apply = () => {
      if (!titleEl || document.activeElement === titleEl) return
      const next = doc!.title.toString()
      if (titleEl.textContent !== next) titleEl.textContent = next
    }
    apply()
    doc.title.observe(apply)
    titleEl.addEventListener('input', () => {
      writeTitle(titleEl?.textContent ?? '')
    })
    titleEl.addEventListener('blur', () => {
      writeTitle((titleEl?.textContent ?? '').replace(/\n/g, ''))
    })
    titleEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        titleEl?.blur()
      }
    })
  }

  onMount(async () => {
    try {
      doc = openLocalDoc()
      if (doc.persistence.synced) persisted = true
      doc.persistence.on('synced', () => {
        persisted = true
      })
      await doc.ready
      ready = true
      queueMicrotask(bindTitle)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not open the local page'
    }
  })

  onDestroy(() => {
    doc?.destroy()
  })
</script>

<div class="app">
  <header class="topbar">
    <div class="brand">Local page</div>
    <div class="status" data-ready={persisted}>
      {#if error}
        {error}
      {:else if persisted}
        Saved in this browser
      {:else}
        Opening local store…
      {/if}
    </div>
  </header>

  <main class="page">
    {#if error}
      <p class="page-error">{error}</p>
    {:else if !ready || !doc}
      <p class="page-loading">Loading page…</p>
    {:else}
      <div
        class="page-title"
        bind:this={titleEl}
        contenteditable="true"
        role="heading"
        aria-level="1"
        aria-label="Page title"
        data-placeholder="Untitled"
        spellcheck="false"
      ></div>
      <Editor fragment={doc.fragment} />
    {/if}
  </main>

  <footer class="hints">
    <span>/h1 /h2 /h3 /tog</span>
    <span>- list</span>
    <span>Tab / Shift+Tab</span>
    <span>Ctrl+B I Z Y</span>
    <span>Shift+Enter break</span>
  </footer>
</div>
