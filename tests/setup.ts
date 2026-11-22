if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener(): void {},
      removeListener(): void {},
      addEventListener(): void {},
      removeEventListener(): void {},
      dispatchEvent(): boolean {
        return false
      }
    })) as typeof window.matchMedia
  }

  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }

  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number
      pointerType: string
      isPrimary: boolean
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params)
        this.pointerId = params.pointerId ?? 1
        this.pointerType = params.pointerType ?? 'mouse'
        this.isPrimary = params.isPrimary ?? true
      }
    }
    const w = window as unknown as { PointerEvent: typeof PointerEvent }
    w.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
  }

  if (typeof document.elementFromPoint !== 'function') {
    document.elementFromPoint = function (): Element | null {
      return null
    }
  }

  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function (): void {}
    Element.prototype.releasePointerCapture = function (): void {}
    Element.prototype.hasPointerCapture = function (): boolean {
      return false
    }
  }
}
