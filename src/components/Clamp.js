import { addListener, removeListener } from 'resize-detector'
import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  watch
} from 'vue'

export default {
  name: 'vue-clamp',
  props: {
    tag: {
      type: String,
      default: 'div',
      required: false
    },
    autoresize: {
      type: Boolean,
      default: false,
      required: false
    },
    maxLines: {
      type: Number,
      default: 2,
      required: false
    },
    maxHeight: {
      type: [Number, String],
      required: false
    },
    ellipsis: {
      type: String,
      default: '…',
      required: false
    },
    location: {
      type: String,
      default: 'end',
      validator: (value) => {
        return ['start', 'middle', 'end'].indexOf(value) !== -1
      },
      required: false
    },
    expanded: {
      type: Boolean,
      default: false,
      required: false
    }
  },
  emits: ['update:expanded', 'clampchange'],
  setup (props, context) {
    const getText = () => {
      if (context.slots.default) {
        const [content] = (context.slots.default() || []).filter(
          (node) => node.children !== ''
        )

        return content && content.children ? content.children.toString() : ''
      }
      return ''
    }

    const offset = ref(0)
    const text = ref(getText())
    const localExpanded = ref(!!props.expanded)
    const unregisterResizeCallback = ref()
    const rootRef = ref(null)
    const textRef = ref(null)
    const contentRef = ref(null)

    watch(
      () => props.expanded,
      (val) => {
        localExpanded.value = val
      }
    )

    onMounted(() => {
      init()
      watch(
        () => [props.maxLines, props.maxHeight, props.ellipsis, isClamped],
        () => {
          update()
        }
      )

      watch(
        () => [props.tag, text, props.autoresize],
        () => {
          init()
        }
      )
    })

    onUpdated(() => {
      text.value = getText()
      applyChange()
    })

    onBeforeUnmount(() => {
      cleanUp()
    })

    watch(localExpanded, (val) => {
      if (val) {
        clampAt(text.value.length)
      } else {
        update()
      }
      if (props.expanded !== val) {
        context.emit('update:expanded', val)
      }
    })

    const init = () => {
      if (!context.slots.default) {
        return
      }
      const contents = context.slots.default()
      if (!contents) {
        return
      }

      offset.value = text.value.length
      cleanUp()

      if (props.autoresize && rootRef.value != null) {
        addListener(rootRef.value, () => {
          update()
        })

        unregisterResizeCallback.value = () => {
          if (rootRef.value != null) {
            removeListener(rootRef.value, update)
          }
        }
      }
      update()
    }

    const cleanUp = () => {
      if (typeof unregisterResizeCallback.value === 'function') {
        unregisterResizeCallback.value()
      }
    }

    const clampedText = computed(() => {
      if (props.location === 'start') {
        return (
          props.ellipsis + (text.value.slice(0, offset.value) || '').trim()
        )
      } else if (props.location === 'middle') {
        const split = Math.floor(offset.value / 2)
        return (
          (text.value.slice(0, split) || '').trim() +
          props.ellipsis +
          (text.value.slice(-split) || '').trim()
        )
      }

      return (text.value.slice(0, offset.value) || '').trim() + props.ellipsis
    })

    const isClamped = computed(() => {
      if (!text.value) return false
      return offset.value !== text.value.length
    })

    watch(
      isClamped,
      (val) => {
        nextTick(() => context.emit('clampchange', val))
      },
      {
        immediate: true
      }
    )

    const realText = computed(() => {
      return isClamped.value ? clampedText.value : text.value
    })

    const realMaxHeight = computed(() => {
      if (localExpanded.value) {
        return null
      }

      if (!props.maxHeight) {
        return null
      }
      return typeof props.maxHeight === 'number'
        ? `${props.maxHeight}px`
        : props.maxHeight
    })

    const update = () => {
      if (localExpanded.value) {
        return
      }
      applyChange()
      if (isOverflow() || isClamped) {
        search()
      }
    }

    const clampAt = (_offset) => {
      offset.value = _offset
      applyChange()
    }

    const moveEdge = (steps) => {
      clampAt(offset.value + steps)
    }

    const fill = () => {
      while (
        (!isOverflow() || getLines() < 2) &&
        offset.value < text.value.length
      ) {
        moveEdge(1)
      }
    }
    const clamp = () => {
      while (isOverflow() && getLines() > 1 && offset.value > 0) {
        moveEdge(-1)
      }
    }

    const stepToFit = () => {
      fill()
      clamp()
    }

    const search = (...range) => {
      const [from = 0, to = offset.value] = range
      if (to - from <= 3) {
        stepToFit()
        return
      }
      const target = Math.floor((to + from) / 2)
      clampAt(target)
      if (isOverflow()) {
        search(from, target)
      } else {
        search(target, to)
      }
    }

    const getLines = () => {
      const result = Object.keys(
        Array.prototype.slice
          .call(contentRef.value.getClientRects())
          .reduce((acc, bound) => {
            const key = `${bound.top}/${bound.bottom}`
            if (!acc[key]) {
              acc[key] = true
            }
            return acc
          }, {})
      )
      return result.length
    }

    const isOverflow = () => {
      if (!props.maxLines && !props.maxHeight) {
        return false
      }

      if (props.maxLines) {
        if (getLines() > props.maxLines) {
          return true
        }
      }

      if (props.maxHeight && rootRef.value) {
        if (rootRef.value.scrollHeight > rootRef.value.offsetHeight) {
          return true
        }
      }
      return false
    }

    const applyChange = () => {
      if (textRef.value != null) {
        textRef.value.textContent = realText.value
      }
    }

    const expand = () => {
      localExpanded.value = true
    }
    const collapse = () => {
      localExpanded.value = false
    }
    const toggle = () => {
      localExpanded.value = !localExpanded.value
    }

    return () => {
      const contents = [
        h(
          'span',
          {
            ref: textRef,
            attrs: {
              'aria-label': text.value.trim()
            }
          },
          realText.value
        )
      ]

      const scope = {
        expand,
        collapse,
        toggle,
        clamped: isClamped.value,
        expanded: localExpanded.value
      }
      const before = context.slots.before
        ? context.slots.before(scope)
        : context.slots.before
      if (before) {
        contents.unshift(...(Array.isArray(before) ? before : [before]))
      }
      const after = context.slots.after
        ? context.slots.after(scope)
        : context.slots.after
      if (after) {
        contents.push(...(Array.isArray(after) ? after : [after]))
      }
      const lines = [
        h(
          'span',
          {
            style: {
              boxShadow: 'transparent 0 0'
            },
            ref: contentRef
          },
          contents
        )
      ]
      return h(
        props.tag,
        {
          ref: rootRef,
          style: {
            maxHeight: realMaxHeight.value,
            overflow: 'hidden'
          }
        },
        lines
      )
    }
  }
}
