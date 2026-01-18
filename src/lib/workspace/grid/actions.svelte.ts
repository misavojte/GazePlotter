import { throttleByRaf } from '$lib/shared/utils/throttle'

type GridRect = { id: number; x: number; y: number; w: number; h: number }
type PreviewUpdate = { id: number; x: number; y: number; w: number; h: number }

export interface DraggableParams {
  enabled: boolean
  id: number
  x: number
  y: number
  w: number
  h: number
  cellSize: { width: number; height: number }
  gap: number
  onWrapStart: () => void
  onWrapEnd: (x: number, y: number) => void
  onPreviewUpdate: (update: PreviewUpdate) => void
  onDragStart: (rect: GridRect) => void
  onDragEnd: (rect: GridRect & { dragComplete: boolean }) => void
  onMove: (rect: GridRect) => void
  updateDragPosition: (x: number, y: number) => void
}

export function draggable(node: HTMLElement, params: DraggableParams) {
  let {
    enabled,
    id,
    x,
    y,
    w,
    h,
    cellSize,
    gap,
    onDragStart,
    onDragEnd,
    onMove,
    onPreviewUpdate,
    onWrapStart,
    onWrapEnd,
    updateDragPosition
  } = params

  if (!enabled) return {}

  let isDragging = false
  let startX: number
  let startY: number
  let startPosX: number
  let startPosY: number
  let startScrollX: number
  let startScrollY: number
  let startWindowScrollX: number
  let startWindowScrollY: number
  let workspaceElement: HTMLElement | null
  let touchId: number | null = null

    // We need to track the last calculated position to pass to onWrapEnd
    // Using a local mutable object to track this effectively across event handlers
    const lastPos = { x, y }

    // Throttled emitter
    const emitThrottledPreview = throttleByRaf(
        (payload: { previewUpdate?: PreviewUpdate }) => {
            if (payload.previewUpdate) onPreviewUpdate(payload.previewUpdate)
        }
    )

    function findWorkspaceContainer() {
        return node.closest('.workspace-container') as HTMLElement | null
    }

    function handleStart(event: MouseEvent | TouchEvent) {
        const isTouchEvent = 'touches' in event
        if (!isTouchEvent && (event as MouseEvent).button !== 0) return

        if (isTouchEvent) {
            const touch = (event as TouchEvent).touches[0]
            touchId = touch.identifier
            startX = touch.clientX
            startY = touch.clientY
        } else {
            startX = (event as MouseEvent).clientX
            startY = (event as MouseEvent).clientY
        }

        workspaceElement = findWorkspaceContainer()
        isDragging = true
        startPosX = x
        startPosY = y
        lastPos.x = x
        lastPos.y = y

        startScrollX = workspaceElement ? workspaceElement.scrollLeft : 0
        startScrollY = workspaceElement ? workspaceElement.scrollTop : 0
        startWindowScrollX = window.scrollX || document.documentElement.scrollLeft
        startWindowScrollY = window.scrollY || document.documentElement.scrollTop

        // Notify wrapper to start drag visualization
        onWrapStart()
        updateDragPosition(x, y) // Initial position

        onDragStart({ id, x, y, w, h })

        if (isTouchEvent) {
            document.addEventListener('touchmove', handleMove, { passive: false, capture: true })
            document.addEventListener('touchend', handleEnd, { capture: true })
            document.addEventListener('touchcancel', handleEnd, { capture: true })
        } else {
            document.addEventListener('mousemove', handleMove, { capture: true })
            document.addEventListener('mouseup', handleEnd, { capture: true })
        }

        event.preventDefault()
    }

    function handleMove(event: MouseEvent | TouchEvent) {
        if (!isDragging) return

        const isTouchEvent = 'touches' in event
        let clientX: number, clientY: number

        if (isTouchEvent) {
            event.preventDefault()
            const touchList = (event as TouchEvent).touches
            let activeTouch: Touch | undefined
            for (let i = 0; i < touchList.length; i++) {
                if (touchList[i].identifier === touchId) {
                    activeTouch = touchList[i]
                    break
                }
            }
            if (!activeTouch) return
            clientX = activeTouch.clientX
            clientY = activeTouch.clientY
        } else {
            clientX = (event as MouseEvent).clientX
            clientY = (event as MouseEvent).clientY
        }

        const currentScrollX = workspaceElement ? workspaceElement.scrollLeft : 0
        const currentScrollY = workspaceElement ? workspaceElement.scrollTop : 0
        const currentWindowScrollX = window.scrollX || document.documentElement.scrollLeft
        const currentWindowScrollY = window.scrollY || document.documentElement.scrollTop

        const scrollDeltaX = currentScrollX - startScrollX + (currentWindowScrollX - startWindowScrollX)
        const scrollDeltaY = currentScrollY - startScrollY + (currentWindowScrollY - startWindowScrollY)

        const deltaX = clientX - startX + scrollDeltaX
        const deltaY = clientY - startY + scrollDeltaY

        const gridDeltaX = Math.round(deltaX / (cellSize.width + gap))
        const gridDeltaY = Math.round(deltaY / (cellSize.height + gap))

        const newX = Math.max(0, startPosX + gridDeltaX)
        const newY = Math.max(0, startPosY + gridDeltaY)

        lastPos.x = newX
        lastPos.y = newY
        updateDragPosition(newX, newY)

        emitThrottledPreview({
            previewUpdate: {
                id,
                x: newX,
                y: newY,
                w,
                h,
            },
        })
    }

    function handleEnd(event?: MouseEvent | TouchEvent) {
        if (!isDragging) return

        touchId = null

        const finalX = lastPos.x
        const finalY = lastPos.y

        onWrapEnd(finalX, finalY)
        onMove({ id, x: finalX, y: finalY, w, h })
        
        onDragEnd({
               id,
               x: finalX,
               y: finalY,
               w,
               h,
               dragComplete: true,
             })

        isDragging = false
        workspaceElement = null

        document.removeEventListener('mousemove', handleMove, { capture: true })
        document.removeEventListener('mouseup', handleEnd, { capture: true })
        document.removeEventListener('touchmove', handleMove, { capture: true })
        document.removeEventListener('touchend', handleEnd, { capture: true })
        document.removeEventListener('touchcancel', handleEnd, { capture: true })
    }

  node.addEventListener('mousedown', handleStart)
  node.addEventListener('touchstart', handleStart, { passive: false })

  return {
    destroy() {
      node.removeEventListener('mousedown', handleStart)
      node.removeEventListener('touchstart', handleStart)
      document.removeEventListener('mousemove', handleMove, { capture: true })
      document.removeEventListener('mouseup', handleEnd, { capture: true })
      document.removeEventListener('touchmove', handleMove, { capture: true })
      document.removeEventListener('touchend', handleEnd, { capture: true })
      document.removeEventListener('touchcancel', handleEnd, { capture: true })
    },
    update(newParams: DraggableParams) {
       // Update closure variables
       enabled = newParams.enabled
       id = newParams.id
       x = newParams.x
       y = newParams.y
       w = newParams.w
       h = newParams.h
       cellSize = newParams.cellSize
       gap = newParams.gap
       onDragStart = newParams.onDragStart
       onDragEnd = newParams.onDragEnd
       onMove = newParams.onMove
       onPreviewUpdate = newParams.onPreviewUpdate
       onWrapStart = newParams.onWrapStart
       onWrapEnd = newParams.onWrapEnd
       updateDragPosition = newParams.updateDragPosition
       
       if (!enabled) {
         node.removeEventListener('mousedown', handleStart)
         node.removeEventListener('touchstart', handleStart)
       } else {
         // make sure getting added if re-enabled
         node.removeEventListener('mousedown', handleStart) 
         node.addEventListener('mousedown', handleStart)
           
         node.removeEventListener('touchstart', handleStart)
         node.addEventListener('touchstart', handleStart, { passive: false })
       }
    }
  }
}

export interface ResizableParams {
  enabled: boolean
  id: number
  x: number
  y: number
  w: number
  h: number
  minW: number
  minH: number
  cellSize: { width: number; height: number }
  gap: number
  onResizeStart: (rect: GridRect) => void
  onResizeEnd: (rect: GridRect & { resizeComplete: boolean }) => void
  onResize: (rect: GridRect) => void
  onPreviewUpdate: (update: PreviewUpdate) => void
  onWrapStart: () => void
  onWrapEnd: (w: number, h: number) => void
  updateResizePosition: (w: number, h: number) => void
}

export function resizable(node: HTMLElement, params: ResizableParams) {
  let {
    enabled,
    id,
    x,
    y,
    w,
    h,
    minW,
    minH,
    cellSize,
    gap,
    onResizeStart,
    onResizeEnd,
    onResize,
    onPreviewUpdate,
    onWrapStart,
    onWrapEnd,
    updateResizePosition
  } = params

  if (!enabled) return {}

  let isResizing = false
  let startX: number
  let startY: number
  let startW: number
  let startH: number
  let lastW: number = w
  let lastH: number = h
  let startScrollX: number
  let startScrollY: number
  let startWindowScrollX: number
  let startWindowScrollY: number
  let workspaceElement: HTMLElement | null
  let touchId: number | null = null

  const emitThrottledPreview = throttleByRaf(
    (payload: { previewUpdate?: PreviewUpdate }) => {
      if (payload.previewUpdate) onPreviewUpdate(payload.previewUpdate)
    }
  )

  function handleStart(event: MouseEvent | TouchEvent) {
    const isTouchEvent = 'touches' in event
    if (!isTouchEvent && (event as MouseEvent).button !== 0) return

    if (isTouchEvent) {
      const touch = (event as TouchEvent).touches[0]
      touchId = touch.identifier
      startX = touch.clientX
      startY = touch.clientY
    } else {
      startX = (event as MouseEvent).clientX
      startY = (event as MouseEvent).clientY
    }

    workspaceElement = node.closest('.workspace-container')
    isResizing = true
    startW = w
    startH = h
    lastW = w
    lastH = h

    startScrollX = workspaceElement ? workspaceElement.scrollLeft : 0
    startScrollY = workspaceElement ? workspaceElement.scrollTop : 0
    startWindowScrollX = window.scrollX || document.documentElement.scrollLeft
    startWindowScrollY = window.scrollY || document.documentElement.scrollTop

    onWrapStart()
    updateResizePosition(w, h)

    document.body.style.setProperty('cursor', 'se-resize', 'important')
    const styleEl = document.createElement('style')
    styleEl.id = 'resize-cursor-override'
    styleEl.textContent = '* { cursor: se-resize !important; }'
    document.head.appendChild(styleEl)

    onResizeStart({ id, x, y, w, h })

    if (isTouchEvent) {
      document.addEventListener('touchmove', handleMove, { passive: false, capture: true })
      document.addEventListener('touchend', handleEnd, { capture: true })
      document.addEventListener('touchcancel', handleEnd, { capture: true })
    } else {
      document.addEventListener('mousemove', handleMove, { capture: true })
      document.addEventListener('mouseup', handleEnd, { capture: true })
    }

    event.preventDefault()
    event.stopPropagation()
  }

  function handleMove(event: MouseEvent | TouchEvent) {
    if (!isResizing) return

    const isTouchEvent = 'touches' in event
    let clientX: number, clientY: number

    if (isTouchEvent) {
      event.preventDefault()
      const touchList = (event as TouchEvent).touches
      let activeTouch: Touch | undefined
      for (let i = 0; i < touchList.length; i++) {
        if (touchList[i].identifier === touchId) {
          activeTouch = touchList[i]
          break
        }
      }
      if (!activeTouch) return
      clientX = activeTouch.clientX
      clientY = activeTouch.clientY
    } else {
      clientX = (event as MouseEvent).clientX
      clientY = (event as MouseEvent).clientY
    }

    const currentScrollX = workspaceElement ? workspaceElement.scrollLeft : 0
    const currentScrollY = workspaceElement ? workspaceElement.scrollTop : 0
    const currentWindowScrollX = window.scrollX || document.documentElement.scrollLeft
    const currentWindowScrollY = window.scrollY || document.documentElement.scrollTop

    const scrollDeltaX = currentScrollX - startScrollX + (currentWindowScrollX - startWindowScrollX)
    const scrollDeltaY = currentScrollY - startScrollY + (currentWindowScrollY - startWindowScrollY)

    const deltaX = clientX - startX + scrollDeltaX
    const deltaY = clientY - startY + scrollDeltaY

    const gridDeltaW = Math.round(deltaX / (cellSize.width + gap))
    const gridDeltaH = Math.round(deltaY / (cellSize.height + gap))

    const newW = Math.max(minW, startW + gridDeltaW)
    const newH = Math.max(minH, startH + gridDeltaH)

    if ((newW !== lastW || newH !== lastH) && newW >= minW && newH >= minH) {
      lastW = newW
      lastH = newH

      updateResizePosition(newW, newH)

      emitThrottledPreview({
        previewUpdate: {
          id,
          x,
          y,
          w: newW,
          h: newH,
        },
      })
    }
  }

  function handleEnd(event?: MouseEvent | TouchEvent) {
    if (!isResizing) return

    touchId = null
    
    document.body.style.cursor = ''
    const styleEl = document.getElementById('resize-cursor-override')
    if (styleEl) styleEl.remove()

    onWrapEnd(lastW, lastH)
    onResize({ id, x, y, w: lastW, h: lastH })
    onResizeEnd({
      id,
      x,
      y,
      w: lastW,
      h: lastH,
      resizeComplete: true,
    })

    isResizing = false
    workspaceElement = null

    document.removeEventListener('mousemove', handleMove, { capture: true })
    document.removeEventListener('mouseup', handleEnd, { capture: true })
    document.removeEventListener('touchmove', handleMove, { capture: true })
    document.removeEventListener('touchend', handleEnd, { capture: true })
    document.removeEventListener('touchcancel', handleEnd, { capture: true })
  }

  node.addEventListener('mousedown', handleStart)
  node.addEventListener('touchstart', handleStart, { passive: false })

  return {
    destroy() {
      if (isResizing) {
        document.body.style.cursor = ''
        const styleEl = document.getElementById('resize-cursor-override')
        if (styleEl) styleEl.remove()
      }
      node.removeEventListener('mousedown', handleStart)
      node.removeEventListener('touchstart', handleStart)
      document.removeEventListener('mousemove', handleMove, { capture: true })
      document.removeEventListener('mouseup', handleEnd, { capture: true })
      document.removeEventListener('touchmove', handleMove, { capture: true })
      document.removeEventListener('touchend', handleEnd, { capture: true })
      document.removeEventListener('touchcancel', handleEnd, { capture: true })
    },
    update(newParams: ResizableParams) {
        enabled = newParams.enabled
        id = newParams.id
        x = newParams.x
        y = newParams.y
        w = newParams.w
        h = newParams.h
        minW = newParams.minW
        minH = newParams.minH
        cellSize = newParams.cellSize
        gap = newParams.gap
        onResizeStart = newParams.onResizeStart
        onResizeEnd = newParams.onResizeEnd
        onResize = newParams.onResize
        onPreviewUpdate = newParams.onPreviewUpdate
        onWrapStart = newParams.onWrapStart
        onWrapEnd = newParams.onWrapEnd
        updateResizePosition = newParams.updateResizePosition
        
        if (!enabled) {
          node.removeEventListener('mousedown', handleStart)
          node.removeEventListener('touchstart', handleStart)
        } else {
           node.removeEventListener('mousedown', handleStart) 
           node.addEventListener('mousedown', handleStart)
           
           node.removeEventListener('touchstart', handleStart)
           node.addEventListener('touchstart', handleStart, { passive: false })
        }
    }
  }
}
