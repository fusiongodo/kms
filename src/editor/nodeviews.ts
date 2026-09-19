import type { Node as PMNode } from 'prosemirror-model'
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view'
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
