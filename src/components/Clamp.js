import { addListener, removeListener } from 'resize-detector'

const UPDATE_TRIGGERS = ['maxLines', 'maxHeight', 'ellipsis', 'isClamped']
const INIT_TRIGGERS = ['tag', 'text', 'autoresize']

export default {
  name: 'vue-clamper',
  props: {
    tag: {
      type: String,
      default: 'div'
    },
    autoresize: {
      type: Boolean,
      default: false
    },
    maxLines: Number,
    maxHeight: [String, Number],
    ellipsis: {
      type: String,
      default: '…'
    },
    expanded: Boolean
  },
  data () {
    return {
      offset: null,
      text: this.getText(),
      localExpanded: !!this.expanded
    }
  },
  computed: {
    clampedText () {
      return this.text.slice(0, this.offset) + this.ellipsis
    },
    isClamped () {
      if (!this.text) {
        return false
      }
      return this.offset !== this.text.length
    },
    realText () {
      return this.isClamped ? this.clampedText : this.text
    },
    realMaxHeight () {
      if (this.localExpanded) {
        return null
      }
      let { maxHeight } = this
      if (!maxHeight) {
        return null
      }
      return typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
    }
  },
  watch: {
    expanded (val) {
      this.localExpanded = val
    },
    localExpanded (val) {
      if (val) {
        this.clampAt(this.text.length)
      } else {
        this.update()
      }
      if (this.expanded !== val) {
        this.$emit('update:expanded', val)
      }
    }
  },
  mounted () {
    this.init()

    INIT_TRIGGERS.forEach(prop => {
      this.$watch(prop, this.init)
    })

    UPDATE_TRIGGERS.forEach(prop => {
      this.$watch(prop, this.update)
    })
  },
  updated () {
    this.text = this.getText()
    this.applyChange()
  },
  beforeDestroy () {
    this.cleanUp()
  },
  methods: {
    init () {
      let contents = this.$slots.default
      if (!contents) {
        return
      }

      this.offset = this.text.length

      this.cleanUp()

      if (this.autoresize) {
        let resizeCallback = () => {
          this.update()
        }
        addListener(this.$el, resizeCallback)
        this.unregisterResizeCallback = () => {
          removeListener(this.$el, resizeCallback)
        }
      }
      this.update()
    },
    update () {
      if (this.localExpanded) {
        return
      }
      this.applyChange()
      if (this.isOverflow() || this.isClamped) {
        this.search()
      }
    },
    expand () {
      this.localExpanded = true
    },
    collapse () {
      this.localExpanded = false
    },
    toggle () {
      this.localExpanded = !this.localExpanded
    },
    isOverflow () {
      if (!this.maxLines && !this.maxHeight) {
        return false
      }

      if (this.maxLines) {
        let actualLines = this.$refs.content.getClientRects().length
        if (actualLines > this.maxLines) {
          return true
        }
      }

      if (this.maxHeight) {
        if (this.$el.scrollHeight > this.$el.offsetHeight) {
          return true
        }
      }
      return false
    },
    getText () {
      // Look for the first non-empty text node
      let [content] = (this.$slots.default || []).filter(node => !node.tag && !node.isComment)
      return content ? content.text : ''
    },
    moveEdge (steps) {
      this.clampAt(this.offset + steps)
    },
    clampAt (offset) {
      this.offset = offset
      this.applyChange()
    },
    applyChange () {
      this.$refs.text.textContent = this.realText
    },
    stepToFit () {
      this.fill()
      this.clamp()
    },
    fill () {
      while (!this.isOverflow() && this.offset < this.text.length) {
        this.moveEdge(1)
      }
    },
    clamp () {
      while (this.isOverflow() && this.offset > 0) {
        this.moveEdge(-1)
      }
    },
    search (...range) {
      let [from = 0, to = this.offset] = range
      if (to - from <= 3) {
        this.stepToFit()
        return
      }
      let target = Math.floor((to + from) / 2)
      this.clampAt(target)
      if (this.isOverflow()) {
        this.search(from, target)
      } else {
        this.search(target, to)
      }
    },
    cleanUp () {
      if (this.unregisterResizeCallback) {
        this.unregisterResizeCallback()
      }
    }
  },
  render (h) {
    let contents = [
      h(
        'span',
        {
          ref: 'text',
          attrs: {
            'aria-label': this.text.trim()
          }
        },
        this.realText
      )
    ]

    let { expand, collapse, toggle } = this
    let scope = { expand, collapse, toggle, clamped: this.isClamped, expanded: this.localExpanded }
    let before = this.$scopedSlots.before
      ? this.$scopedSlots.before(scope)
      : this.$slots.before
    if (before) {
      contents.unshift(...(Array.isArray(before) ? before : [before]))
    }
    let after = this.$scopedSlots.after
      ? this.$scopedSlots.after(scope)
      : this.$slots.after
    if (after) {
      contents.push(...(Array.isArray(after) ? after : [after]))
    }
    let lines = [
      h(
        'span',
        {
          style: {
            boxShadow: 'transparent 0 0'
          },
          ref: 'content'
        },
        contents
      )
    ]
    return h(
      this.tag,
      {
        style: {
          maxHeight: this.realMaxHeight,
          overflow: 'hidden'
        }
      },
      lines
    )
  }
}
