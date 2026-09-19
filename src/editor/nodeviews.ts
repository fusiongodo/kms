import type { Node as PMNode } from 'prosemirror-model'
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view'
import { getPageTitle, watchPageTitle } from '../pages/workspace'
import { toggleCollapsed } from './commands'
import { isCollapsed } from './schema'

export class ToggleView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  caret: HTMLButtonElement

  constructor(
    private node: PMNode,
    private view: EditorView,
    private getPos: () => number | undefined,
  ) {
    this.dom = document.createElement('div')
    this.dom.className = 'block toggle'
    this.dom.setAttribute('data-toggle', '')
    this.dom.setAttribute('data-block-id', node.attrs.id ?? '')

    this.caret = document.createElement('button')
    this.caret.type = 'button'
    this.caret.className = 'toggle-caret'
    this.caret.setAttribute('aria-label', 'Toggle')
    this.caret.addEventListener('mousedown', (event) => {
      event.preventDefault()
    })
    this.caret.addEventListener('click', (event) => {
      event.preventDefault()
      const pos = this.getPos()
      if (pos == null) return
      toggleCollapsed(pos)(this.view.state, this.view.dispatch)
    })

    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'toggle-content'

    this.dom.append(this.caret, this.contentDOM)
    this.update(node)
  }

  update(node: PMNode) {
    if (node.type.name !== 'toggle') return false
    this.node = node
    this.dom.setAttribute('data-block-id', node.attrs.id ?? '')
    const collapsed = isCollapsed(node.attrs.collapsed)
    this.dom.classList.toggle('is-collapsed', collapsed)
    this.dom.setAttribute('data-collapsed', collapsed ? 'true' : 'false')
    this.caret.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
    return true
  }

  ignoreMutation(mutation: ViewMutationRecord) {
    return this.caret === mutation.target || this.caret.contains(mutation.target as Node)
  }

  stopEvent(event: Event) {
    return this.caret === event.target || this.caret.contains(event.target as Node)
  }
}

export class PageLinkView implements NodeView {
  dom: HTMLElement
  label: HTMLSpanElement
  unwatch: () => void

  constructor(
    private node: PMNode,
    _view: EditorView,
    _getPos: () => number | undefined,
    private openPage: (pageId: string) => void,
  ) {
    this.dom = document.createElement('div')
    this.dom.className = 'block page-link'
    this.dom.setAttribute('data-page-id', node.attrs.pageId ?? '')
    this.dom.setAttribute('data-block-id', node.attrs.id ?? '')
    this.dom.setAttribute('role', 'link')
    this.dom.tabIndex = 0

    const icon = document.createElement('span')
    icon.className = 'page-link-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = '▸'

    this.label = document.createElement('span')
    this.label.className = 'page-link-title'

    this.dom.append(icon, this.label)
    this.paint(node.attrs.pageId, node.attrs.title)

    this.dom.addEventListener('mousedown', (event) => {
      event.preventDefault()
    })
    this.dom.addEventListener('click', (event) => {
      event.preventDefault()
      const pageId = this.node.attrs.pageId
      if (pageId) this.openPage(pageId)
    })

    this.unwatch = watchPageTitle((id, title) => {
      if (id === this.node.attrs.pageId) this.paint(id, title)
    })
  }

  private paint(pageId: string | null, fallback: string) {
    const title = (pageId && getPageTitle(pageId)) || fallback || 'Untitled'
    this.label.textContent = title
    this.dom.setAttribute('data-page-title', title)
    this.dom.setAttribute('aria-label', `Open ${title}`)
  }

  update(node: PMNode) {
    if (node.type.name !== 'page_link') return false
    this.node = node
    this.dom.setAttribute('data-page-id', node.attrs.pageId ?? '')
    this.dom.setAttribute('data-block-id', node.attrs.id ?? '')
    this.paint(node.attrs.pageId, node.attrs.title)
    return true
  }

  ignoreMutation() {
    return true
  }

  destroy() {
    this.unwatch()
  }
}

export class PageMentionView implements NodeView {
  dom: HTMLElement
  unwatch: () => void

  constructor(
    private node: PMNode,
    _view: EditorView,
    _getPos: () => number | undefined,
    private openPage: (pageId: string) => void,
  ) {
    this.dom = document.createElement('span')
    this.dom.className = 'page-mention'
    this.dom.setAttribute('data-page-mention', '')
    this.dom.setAttribute('role', 'link')
    this.dom.tabIndex = 0
    this.paint(node.attrs.pageId, node.attrs.title)

    this.dom.addEventListener('mousedown', (event) => {
      event.preventDefault()
    })
    this.dom.addEventListener('click', (event) => {
      event.preventDefault()
      const pageId = this.node.attrs.pageId
      if (pageId) this.openPage(pageId)
    })

    this.unwatch = watchPageTitle((id, title) => {
      if (id === this.node.attrs.pageId) this.paint(id, title)
    })
  }

  private paint(pageId: string | null, fallback: string) {
    const title = (pageId && getPageTitle(pageId)) || fallback || 'Untitled'
    this.dom.textContent = title
    this.dom.setAttribute('data-page-id', pageId ?? '')
    this.dom.setAttribute('data-page-title', title)
    this.dom.setAttribute('aria-label', `Open ${title}`)
  }

  update(node: PMNode) {
    if (node.type.name !== 'page_mention') return false
    this.node = node
    this.paint(node.attrs.pageId, node.attrs.title)
    return true
  }

  ignoreMutation() {
    return true
  }

  destroy() {
    this.unwatch()
  }
}
