<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import Editor from './lib/Editor.svelte'
  import type { EditorHooks } from './editor/hooks'
  import type { LocalDoc } from './editor/persist'
  import {
    canGoBack,
    destroyWorkspace,
    getHomeId,
    getPageTitle,
    goBack,
    notePopState,
    openCatalog,
    openPage,
    pageIdFromHash,
    pushPageUrl,
    replacePageUrl,
    watchPageTitle,
  } from './pages/workspace'

  let doc = $state<LocalDoc | undefined>()
  let pageId = $state('')
  let pageTitle = $state('Untitled')
  let ready = $state(false)
  let persisted = $state(false)
  let error = $state<string | null>(null)
  let backAvailable = $state(false)

  function paintTitle(id: string) {
    pageTitle = getPageTitle(id)
    document.title = pageTitle
  }

  async function showPage(id: string) {
    const next = openPage(id)
    await next.ready
    doc = next
    pageId = id
    persisted = next.persistence.synced
    next.persistence.on('synced', () => {
      persisted = true
    })
    paintTitle(id)
    backAvailable = canGoBack()
  }

  async function openLinkedPage(id: string) {
    if (id === pageId) return
    pushPageUrl(id)
    await showPage(id)
  }

  const hooks = $derived<EditorHooks>({
    onOpenPage: (id) => {
      void openLinkedPage(id)
    },
    goBack: () => goBack(),
    pageId,
  })

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault()
        goBack()
      }
    }
    const onPop = () => {
      notePopState()
      const id = (history.state && history.state.pageId) || pageIdFromHash() || getHomeId()
      void showPage(id)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('popstate', onPop)
    const stopWatch = watchPageTitle((id, title) => {
      if (id === pageId) {
        pageTitle = title
        document.title = title
      }
    })

    void openCatalog()
      .then(async (catalog) => {
        const startId = pageIdFromHash() || catalog.homeId
        replacePageUrl(startId)
        await showPage(startId)
        ready = true
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : 'Could not open the local page'
      })

    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
      stopWatch()
    }
  })

  onDestroy(() => {
    destroyWorkspace()
  })
</script>

<div class="app">
  <header class="topbar">
    <button
      type="button"
      class="back"
      disabled={!backAvailable}
      onclick={() => goBack()}
    >
      ← Back
    </button>
    <div class="current-title">{pageTitle}</div>
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
      {#key pageId}
        <Editor fragment={doc.fragment} {hooks} />
      {/key}
    {/if}
  </main>

  <footer class="hints">
    <span>/page</span>
    <span>Alt+← back</span>
    <span>/h1 /h2 /h3 /tog</span>
    <span>- list</span>
    <span>Tab / Shift+Tab</span>
    <span>Ctrl+B I Z Y</span>
  </footer>
</div>
