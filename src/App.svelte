<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import Editor from './lib/Editor.svelte'
  import { openLocalDoc, type LocalDoc } from './editor/persist'

  let doc = $state<LocalDoc | undefined>()
  let ready = $state(false)
  let persisted = $state(false)
  let error = $state<string | null>(null)

  onMount(async () => {
    try {
      doc = openLocalDoc()
      if (doc.persistence.synced) persisted = true
      doc.persistence.on('synced', () => {
        persisted = true
      })
      await doc.ready
      ready = true
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
      <Editor fragment={doc.fragment} />
    {/if}
  </main>

  <footer class="hints">
    <span>/h1 /h2 /h3 /tog</span>
    <span>- list</span>
    <span>Tab / Shift+Tab</span>
    <span>Ctrl+B I Z Y</span>
    <span>Enter new block</span>
  </footer>
</div>
