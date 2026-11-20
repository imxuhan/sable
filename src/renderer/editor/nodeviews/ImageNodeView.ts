import type { Node as PMNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'

export class ImageNodeView implements NodeView {
  dom: HTMLElement
  private node: PMNode
  private view: EditorView
  private getPos: () => number | undefined
  private getDocPath: () => string | null
  private imgEl: HTMLImageElement
  private resizeHandle: HTMLElement
  private contextMenuEl: HTMLElement | null = null

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    getDocPath: () => string | null
  ) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.getDocPath = getDocPath

    this.dom = document.createElement('span')
    this.dom.className = 'sable-image-wrapper'
    this.dom.contentEditable = 'false'

    this.imgEl = document.createElement('img')
    this.imgEl.className = 'sable-image-el'
    this.imgEl.draggable = false

    this.resizeHandle = document.createElement('span')
    this.resizeHandle.className = 'sable-image-resize-handle'
    this.resizeHandle.title = '拖拽调整图片宽度'

    this.resizeHandle.addEventListener('mousedown', (e) => this.startDragResize(e))
    this.dom.addEventListener('contextmenu', (e) => this.openImageContextMenu(e))

    this.dom.appendChild(this.imgEl)
    this.dom.appendChild(this.resizeHandle)

    this.syncImageElement()
  }

  private syncImageElement(): void {
    const { src, alt, title, zoom, width } = this.node.attrs
    const resolvedUrl =
      typeof window !== 'undefined' && window.sable
        ? window.sable.resolveAssetUrl(src || '', this.getDocPath())
        : src || ''

    this.imgEl.src = resolvedUrl
    this.imgEl.alt = alt || ''
    this.imgEl.title = title || ''

    this.imgEl.style.width = ''
    if (width !== null && Number.isFinite(width)) {
      this.imgEl.style.width = `${width}px`
    } else if (zoom !== null && Number.isFinite(zoom)) {
      this.imgEl.style.width = `${zoom}%`
    }
  }

  private startDragResize(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startWidth = this.imgEl.getBoundingClientRect().width || 300

    const onMove = (moveEvt: MouseEvent): void => {
      const nextWidth = Math.max(60, Math.round(startWidth + (moveEvt.clientX - startX)))
      this.imgEl.style.width = `${nextWidth}px`
    }

    const onUp = (upEvt: MouseEvent): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const finalWidth = Math.max(60, Math.round(startWidth + (upEvt.clientX - startX)))
      const pos = this.getPos()
      if (pos !== undefined) {
        const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
          ...this.node.attrs,
          width: finalWidth,
          zoom: null
        })
        this.view.dispatch(tr)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  private applyZoomPreset(zoom: number | null): void {
    const pos = this.getPos()
    if (pos === undefined) return
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      zoom: zoom === 100 ? null : zoom,
      width: null
    })
    this.view.dispatch(tr)
  }

  private closeContextMenu(): void {
    if (this.contextMenuEl) {
      this.contextMenuEl.remove()
      this.contextMenuEl = null
    }
  }

  private openImageContextMenu(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    this.closeContextMenu()

    const menu = document.createElement('div')
    menu.className = 'sable-image-context-menu'
    menu.style.left = `${Math.min(window.innerWidth - 190, e.clientX)}px`
    menu.style.top = `${Math.min(window.innerHeight - 230, e.clientY)}px`

    const presets = [
      { label: '缩放至 25%', zoom: 25 },
      { label: '缩放至 50%', zoom: 50 },
      { label: '缩放至 67%', zoom: 67 },
      { label: '恢复 100% 原始比例', zoom: 100 }
    ]

    for (const preset of presets) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'sable-image-menu-item'
      const isCurrent =
        (preset.zoom === 100 && this.node.attrs.zoom === null && this.node.attrs.width === null) ||
        this.node.attrs.zoom === preset.zoom
      btn.textContent = isCurrent ? `✓ ${preset.label}` : `   ${preset.label}`
      btn.addEventListener('click', () => {
        this.applyZoomPreset(preset.zoom)
        this.closeContextMenu()
      })
      menu.appendChild(btn)
    }

    const divider = document.createElement('div')
    divider.className = 'sable-image-menu-divider'
    menu.appendChild(divider)

    const copyMdBtn = document.createElement('button')
    copyMdBtn.type = 'button'
    copyMdBtn.className = 'sable-image-menu-item'
    copyMdBtn.textContent = '   复制图片路径'
    copyMdBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(this.node.attrs.src || '')
      this.closeContextMenu()
    })
    menu.appendChild(copyMdBtn)

    document.body.appendChild(menu)
    this.contextMenuEl = menu

    const dismiss = (evt: MouseEvent): void => {
      if (this.contextMenuEl && !this.contextMenuEl.contains(evt.target as Node)) {
        this.closeContextMenu()
        window.removeEventListener('mousedown', dismiss)
      }
    }
    setTimeout(() => window.addEventListener('mousedown', dismiss), 0)
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.syncImageElement()
    return true
  }

  selectNode(): void {
    this.dom.classList.add('is-selected')
  }

  deselectNode(): void {
    this.dom.classList.remove('is-selected')
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    this.closeContextMenu()
  }
}
