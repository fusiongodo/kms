import { Schema } from 'prosemirror-model'
import { newBlockId } from './ids'

export function isCollapsed(value: unknown): boolean {
  return value === true || value === 'true'
}

const idAttr = {
  id: {
    default: null as string | null,
  },
}

export const schema = new Schema({
  nodes: {
    doc: {
      content: 'block+',
    },

    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { ...idAttr },
      parseDOM: [
        {
          tag: 'p',
          getAttrs: (dom) => ({
            id: (dom as HTMLElement).getAttribute('data-block-id') || null,
          }),
        },
      ],
      toDOM: (node) => [
        'p',
        {
          'data-block-id': node.attrs.id,
          class: 'block paragraph',
        },
        0,
      ],
    },

    heading: {
      group: 'block',
      content: 'inline*',
      defining: true,
      attrs: {
        ...idAttr,
        level: { default: 1 },
      },
      parseDOM: [1, 2, 3].map((level) => ({
        tag: `h${level}`,
        getAttrs: (dom: HTMLElement | string) => ({
          level,
          id:
            typeof dom === 'string'
              ? null
              : dom.getAttribute('data-block-id') || null,
        }),
      })),
      toDOM: (node) => [
        `h${Number(node.attrs.level) || 1}`,
        {
          'data-block-id': node.attrs.id,
          class: `block heading heading-${Number(node.attrs.level) || 1}`,
        },
        0,
      ],
    },

    bullet_list: {
      group: 'block',
      content: 'list_item+',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', { class: 'bullet-list' }, 0],
    },

    list_item: {
      content: 'block+',
      defining: true,
      attrs: { ...idAttr },
      parseDOM: [
        {
          tag: 'li',
          getAttrs: (dom) => ({
            id: (dom as HTMLElement).getAttribute('data-block-id') || null,
          }),
        },
      ],
      toDOM: (node) => [
        'li',
        {
          'data-block-id': node.attrs.id,
          class: 'block list-item',
        },
        0,
      ],
    },

    toggle: {
      group: 'block',
      content: 'toggle_title toggle_body',
      defining: true,
      attrs: {
        ...idAttr,
        collapsed: { default: false },
      },
      parseDOM: [
        {
          tag: 'div[data-toggle]',
          getAttrs: (dom) => {
            const el = dom as HTMLElement
            return {
              id: el.getAttribute('data-block-id') || null,
              collapsed: isCollapsed(el.getAttribute('data-collapsed')),
            }
          },
        },
      ],
      toDOM: (node) => [
        'div',
        {
          'data-toggle': '',
          'data-block-id': node.attrs.id,
          'data-collapsed': node.attrs.collapsed ? 'true' : 'false',
          class: `block toggle${isCollapsed(node.attrs.collapsed) ? ' is-collapsed' : ''}`,
        },
        0,
      ],
    },

    toggle_title: {
      content: 'inline*',
      defining: true,
      parseDOM: [{ tag: 'div[data-toggle-title]' }],
      toDOM: () => ['div', { 'data-toggle-title': '', class: 'toggle-title' }, 0],
    },

    toggle_body: {
      content: 'block*',
      parseDOM: [{ tag: 'div[data-toggle-body]' }],
      toDOM: () => ['div', { 'data-toggle-body': '', class: 'toggle-body' }, 0],
    },

    text: {
      group: 'inline',
    },

    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
  },
  marks: {
    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b' },
        {
          style: 'font-weight',
          getAttrs: (value) =>
            /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
        },
      ],
      toDOM: () => ['strong', 0],
    },
    em: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
      toDOM: () => ['em', 0],
    },
  },
})

export function createEmptyDoc(title = '') {
  const heading = title
    ? schema.node('heading', { id: newBlockId(), level: 1 }, [schema.text(title)])
    : schema.node('heading', { id: newBlockId(), level: 1 }, [])
  return schema.node('doc', null, [
    heading,
    schema.node('paragraph', { id: newBlockId() }, []),
  ])
}

export function createParagraph(text = '') {
  const content = text ? [schema.text(text)] : undefined
  return schema.node('paragraph', { id: newBlockId() }, content)
}

export function createHeading(level: 1 | 2 | 3, text = '') {
  const content = text ? [schema.text(text)] : undefined
  return schema.node('heading', { id: newBlockId(), level }, content)
}

export function createToggle(collapsed = false) {
  return schema.node('toggle', { id: newBlockId(), collapsed }, [
    schema.node('toggle_title', null, []),
    schema.node('toggle_body', null, []),
  ])
}

export function createListItem(text = '') {
  return schema.node('list_item', { id: newBlockId() }, [
    createParagraph(text),
  ])
}

export function createBulletList(text = '') {
  return schema.node('bullet_list', null, [createListItem(text)])
}
