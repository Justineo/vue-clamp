<template>
<article id="app">
  <h1 @click="pascal = !pascal">&lt;{{ pascal ? 'VueClamp' : 'vue-clamp' }}&gt;</h1>
  <div id="lang" class="lang btn-group">
    <button class="btn btn-sm" :class="{ active: !zh }" @click="zh = false">English</button>
    <button class="btn btn-sm" :class="{ active: zh }" @click="zh = true">中文</button>
  </div>
  <p>{{ zh ? '轻松实现多行文本截断。' : 'Clamping multiline text with ease.' }}</p>
  <p>
    <a
      class="tooltip"
      href="https://github.com/Justineo/vue-clamp"
      :data-tooltip="zh ? '前往 GitHub 仓库' : 'Visit GitHub repo'"
    >GitHub →</a>
  </p>
  <h2 id="features">
    <a href="#features">#</a>
    {{ zh ? '功能' : 'Features' }}
  </h2>
  <ul>
    <li>{{ zh ? '可以选择限制行数与/或最大高度，无需指定行高。' : 'Clamps text with max lines and/or max height. No need to specify line height.' }}</li>
    <li>{{ zh ? '支持在布局变化时自动更新。' : 'Automatically updates upon layout change.' }}</li>
    <li>{{ zh ? '支持展开/收起被截断部分内容。' : 'The clamped text can be expanded/collapsed.' }}</li>
    <li>{{ zh ? '支持自定义截断文本前后内容，并且进行响应式更新。' : 'Customizable and responsive content before/after clamped text.' }}</li>
  </ul>
  <h2 id="demo">
    <a href="#demo">#</a> Demo
  </h2>
  <div class="divider text-center" data-content="↓ max-lines & slot `after`"/>
  <section class="case">
    <div class="form-horizontal">
      <div class="form-group">
        <label class="form-label col-5 col-sm-12" for="lines">{{ zh ? '最大行数' : 'Max lines' }}</label>
        <div class="col-7 col-sm-12">
          <input
            id="lines"
            v-model.number="lines"
            class="form-input"
            type="number"
            min="1"
            max="8"
            step="1"
          >
        </div>
      </div>
      <div class="form-group">
        <label
          class="form-label col-5 col-sm-12"
          for="width1"
        >{{ zh ? '容器宽度' : 'Container width' }}</label>
        <div class="col-7 col-sm-12 tooltip" :data-tooltip="`${width1}px`">
          <input id="width1" v-model="width1" class="slider" type="range" min="240" max="600">
        </div>
      </div>
      <div v-if="!zh" class="form-group">
        <div class="col-5 col-sm-12">
          <label class="form-checkbox">
            <input v-model="hyphens1" type="checkbox">
            <i class="form-icon"/>
            CSS Hyphens
          </label>
        </div>
        <div class="col-5 col-sm-12">
          <label class="form-checkbox">
            <input v-model="rtl1" type="checkbox">
            <i class="form-icon"/>
            RTL
          </label>
        </div>
      </div>
    </div>
    <v-clamp
      :class="{
        demo: true,
        hyphens: hyphens1,
        rtl: rtl1
      }"
      :max-lines="lines"
      autoresize
      :style="{
        width: `${width1}px`
      }"
    >
      {{ zh ? textZh : text }}
      <template #after="{ toggle, expanded, clamped }">
        <button
          v-if="expanded || clamped"
          class="toggle btn btn-sm"
          @click="toggle"
        >{{ zh ? '切换' : 'Toggle' }}</button>
      </template>
    </v-clamp>
  </section>
  <div class="divider text-center" data-content="↓ max-height & slot `before`"/>
  <section class="case">
    <div class="form-horizontal">
      <div class="form-group">
        <label class="form-label col-5 col-sm-12" for="height">{{ zh ? '最大高度' : 'Max height' }}</label>
        <div
          class="col-7 col-sm-12 tooltip"
          :data-tooltip="zh ? '任意 CSS 长度值' : 'Any valid CSS length value'"
        >
          <input id="height" v-model="height" class="form-input">
        </div>
      </div>
      <div class="form-group">
        <label
          class="form-label col-5 col-sm-12"
          for="width2"
        >{{ zh ? '容器宽度' : 'Container width' }}</label>
        <div class="col-7 col-sm-12 tooltip" :data-tooltip="`${width2}px`">
          <input id="width2" v-model="width2" class="slider" type="range" min="240" max="600">
        </div>
      </div>
      <div v-if="!zh" class="form-group">
        <div class="col-5 col-sm-12">
          <label class="form-checkbox">
            <input v-model="hyphens2" type="checkbox">
            <i class="form-icon"/>
            CSS Hyphens
          </label>
        </div>
        <div class="col-5 col-sm-12">
          <label class="form-checkbox">
            <input v-model="rtl2" type="checkbox">
            <i class="form-icon"/>
            RTL
          </label>
        </div>
      </div>
      <div class="form-group">
        <div class="col-5 col-sm-12">
          <label class="form-checkbox">
            <input v-model="expanded1" type="checkbox">
            <i class="form-icon"/>
            {{ zh ? '展开内容' : 'Expanded' }}
          </label>
        </div>
      </div>
    </div>
    <v-clamp
      :class="{
        demo: true,
        hyphens: hyphens2,
        rtl: rtl2
      }"
      :max-height="height"
      autoresize
      :expanded.sync="expanded1"
      :style="{
        width: `${width2}px`
      }"
    >
      {{ zh ? textZh : text }}
      <template #before>
        <span class="featured label label-rounded label-primary">{{ zh ? '推荐' : 'Featured' }}</span>
      </template>
    </v-clamp>
  </section>
  <div class="divider text-center" data-content="↓ `clampchange` event"/>
  <section class="case">
    <div class="form-horizontal">
      <div class="form-group">
        <label class="form-label col-5 col-sm-12" for="lines3">{{ zh ? '最大行数' : 'Max lines' }}</label>
        <div class="col-7 col-sm-12">
          <input
            id="lines3"
            v-model.number="lines3"
            class="form-input"
            type="number"
            min="1"
            max="8"
            step="1"
          >
        </div>
      </div>
      <div class="form-group">
        <label
          class="form-label col-5 col-sm-12"
          for="width3"
        >{{ zh ? '容器宽度' : 'Container width' }}</label>
        <div class="col-7 col-sm-12 tooltip" :data-tooltip="`${width3}px`">
          <input id="width3" v-model="width3" class="slider" type="range" min="240" max="600">
        </div>
      </div>
      <div v-if="!zh" class="form-group">
        <div class="col-5 col-sm-12">
          <label class="form-checkbox">
            <input v-model="hyphens3" type="checkbox">
            <i class="form-icon"/>
            CSS Hyphens
          </label>
        </div>
        <div class="col-5 col-sm-12">
          <label class="form-checkbox">
            <input v-model="rtl3" type="checkbox">
            <i class="form-icon"/>
            RTL
          </label>
        </div>
      </div>
    </div>
    <v-clamp
      :class="{
        demo: true,
        hyphens: hyphens3,
        rtl: rtl3
      }"
      :max-lines="lines3"
      autoresize
      :style="{
        width: `${width3}px`
      }"
      @clampchange="clamped3 = $event"
    >{{ zh ? textZh : text }}</v-clamp>
    <p
      class="mt-2"
    >{{ zh ? '截断状态：' + (clamped3 ? '已截断' : '未截断') : 'Clamped: ' + (clamped3 ? 'Yes' : 'No')}}</p>
  </section>
  <h2 id="usage">
    <a href="#usage">#</a>
    {{ zh ? '使用方法' : 'Usage' }}
  </h2>
  <div class="divider text-center" :data-content="zh ? '↓ 安装' : '↓ Installation'"/>
  <pre class="code shell" data-lang="Shell"><code>$ npm i --save vue-clamp</code></pre>
  <div class="divider text-center" :data-content="zh ? '↓ 配置' : '↓ Configuration'"/>
  <p v-if="zh">
    对于基于 webpack 的项目，
    <code>import</code> 会自动引入未经转译的 ES Module 版本。请确保按如下指导配置相关工具。
  </p>
  <p v-else>
    For project based on webpack,
    <code>import</code> will load the untranspiled ES Module version. Please make sure to add the correct config according to following instructions.
  </p>
  <details open>
    <summary>
      <h4>
        Vue CLI
        <small>v3</small>
      </h4>
    </summary>
    <p v-if="zh">
      对于使用 Vue CLI 3 创建的项目，请确保将
      <code>vue-clamp</code> 与
      <code>resize-detector</code> 加入
      <code>vue.config.js</code> 文件的
      <code>transpileDependencies</code> 选项中：
    </p>
    <p v-else>
      For projects created with Vue CLI 3, remember to add
      <code>vue-clamp</code> and
      <code>resize-detector</code> into the
      <code>transpileDependencies</code> option in
      <code>vue.config.js</code>:
    </p>
    <pre class="code javascript" data-lang="JavaScript"><code>module.exports = {
  transpileDependencies: ['vue-clamp', 'resize-detector']
}
</code></pre>
  </details>
  <details>
    <summary>
      <h4>
        Vue CLI
        <small>v2</small>
      </h4>
    </summary>
    <p v-if="zh">
      如果使用的是 Vue CLI 2 的
      <code>webpack</code> 模板，请按如下方式修改
      <code>build/webpack.base.conf.js</code>：
    </p>
    <p v-else>
      For Vue CLI 2 with the
      <code>webpack</code> template, modify
      <code>build/webpack.base.conf.js</code> like this:
    </p>
    <pre class="code diff" data-lang="Diff"><code>      {
        test: /\.js$/,
        loader: 'babel-loader',
-       include: [resolve('src'), resolve('test')]
+       include: [
+         resolve('src'),
+         resolve('test'),
+         resolve('node_modules/vue-clamp'),
+         resolve('node_modules/resize-detector')
+       ]
      }
</code></pre>
  </details>
  <details>
    <summary>
      <h4>
        Nuxt.js
        <small>v2</small>
      </h4>
    </summary>
    <p v-if="zh">
      在 Nuxt.js 中使用时，请确保将
      <code>vue-clamp</code> 与
      <code>resize-detector</code> 加入
      <code>nuxt.config.js</code> 文件的
      <code>build.transpile</code> 选项中：
    </p>
    <p v-else>
      When using in Nuxt.js, remember to add
      <code>vue-clamp</code> and
      <code>resize-detector</code> into the
      <code>build.transpile</code> option in
      <code>nuxt.config.js</code>:
    </p>
    <pre class="code javascript" data-lang="JavaScript"><code>module.exports = {
  build: {
    transpile: ['vue-clamp', 'resize-detector']
  }
}
</code></pre>
  </details>
  <div class="divider text-center" :data-content="zh ? '↓ 代码样例' : '↓ Code example'"/>
  <pre v-pre class="code vue" data-lang="Vue"><code>&lt;template&gt;
&lt;v-clamp autoresize :max-lines="3"&gt;&#x7B;&#x7B; text &#x7D;&#x7D;&lt;/v-clamp&gt;
&lt;/template&gt;

&lt;script&gt;
import VClamp from 'vue-clamp'

export default {
  components: {
    VClamp
  },
  data () {
    return {
      text: 'Some very very long text content.'
    }
  }
}
&lt;/script&gt;
</code></pre>
  <h2 id="api">
    <a href="#api">#</a> API
  </h2>
  <div class="divider text-center" data-content="↓ Props"/>
  <section>
    <ul>
      <li>
        <p>
          <code>tag: string</code>
        </p>
        <p>{{ zh ? '生成的根元素的标签名。' : 'The tag name of the generated root element.' }}</p>
        <p>
          {{ defaultText }}
          <code>div</code>
        </p>
      </li>
      <li>
        <p>
          <code>autoresize: boolean</code>
        </p>
        <p>{{ zh ? '是否要自动适配根元素的尺寸变化。' : 'Whether to observe the root element\'s size.' }}</p>
        <p>
          {{ defaultText }}
          <code>false</code>
        </p>
      </li>
      <li>
        <p>
          <code>max-lines: number</code>
        </p>
        <p>{{ zh ? '可以显示的最大行数' : 'The max number of lines that can be displayed.' }}</p>
      </li>
      <li>
        <p>
          <code>max-height: number|string</code>
        </p>
        <p v-if="zh">
          根元素的最大高度。数字值将被转换为
          <code>px</code> 单位；字符串值将直接作为 CSS 属性
          <code>max-height</code> 输出。
        </p>
        <p v-else>
          The max height of the root element. Number values are converted to
          <code>px</code> units. String values are used directly as the
          <code>max-height</code> CSS property.
        </p>
      </li>
      <li>
        <p>
          <code>ellipsis: string</code>
        </p>
        <p>{{ zh ? '当文字被截断时需要显示的省略号字符串。' : 'The ellipsis characters displayed when the text is clamped.' }}</p>
        <p>
          {{ defaultText }}
          <code>'…'</code>
        </p>
      </li>
      <li>
        <p>
          <code>expanded: boolean</code>
        </p>
        <p>
          <span
            class="label label-primary tooltip"
            :data-tooltip="zh ? '支持 .sync 修饰符' : 'Supports .sync modifier'"
          >.sync</span>
        </p>
        <p>{{ zh ? '是否展开显式被截断的文本。' : 'Whether the clamped area is expanded.' }}</p>
        <p>
          {{ defaultText }}
          <code>false</code>
        </p>
      </li>
    </ul>
  </section>
  <div class="divider text-center" data-content="↓ Slots"/>
  <section>
    <ul>
      <li>
        <p>
          <code>default</code>
        </p>
        <p>{{ zh ? '需要截断的文本。只能包含纯文本内容。' : 'The text to clamp. Can only contain pure text.' }}</p>
      </li>
      <li>
        <p>
          <code>before</code>
        </p>
        <p>
          Slot {{ zh ? '作用域：' : 'scope:' }}
          <code>{ expand, collapse, toggle, clamped, expanded }</code>
        </p>
        <section class="secondary">
          <p>
            <code>expand: function(): void</code>
            - {{ zh ? '展开被截断的文本。' : 'Expand the clamped text.' }}
          </p>
          <p>
            <code>collapse: function(): void</code>
            - {{ zh ? '收起展开后的文本。' : 'Collapse the expanded text.' }}
          </p>
          <p>
            <code>toggle: function(): void</code>
            - {{ zh ? '切换被截断文本的展开状态。' : 'Toggle the expand state of clamped text.' }}
          </p>
          <p>
            <code>clamped: Boolean</code>
            - {{ zh ? '内容是否处于截断状态。' : 'Whether text content is being clamped.' }}
          </p>
          <p>
            <code>expanded: Boolean</code>
            - {{ zh ? '内容是否处于展开状态。' : 'Whether text content is being expanded.' }}
          </p>
        </section>
        <p>{{ zh ? '在被截断的文本前显式的内容，可以包含任意类型内容。' : 'Content displayed before the clamped text. Can contain anything.' }}</p>
      </li>
      <li>
        <p>
          <code>after</code>
        </p>
        <p v-if="zh">
          Slot 作用域：与
          <code>before</code> 相同。
        </p>
        <p v-else>
          Slot scope: Same as
          <code>before</code>.
        </p>
        <p>{{ zh ? '在被截断的文本后显式的内容，可以包含任意类型内容。' : 'Content displayed after the clamped text. Can contain anything.' }}</p>
      </li>
    </ul>
  </section>
  <div class="divider text-center" data-content="↓ Events"/>
  <section>
    <ul>
      <li>
        <p>
          <code>clampchange</code>
        </p>
        <p>{{ zh ? '截断状态变化时触发。' : 'Emitted when clamp state changes.' }}</p>
        <p>
          {{ parameterText }}
          <code>(clamped: Boolean)</code>
        </p>
      </li>
    </ul>
  </section>
  <footer>
    <p v-if="zh">
      由
      <a href="https://github.com/Justineo">@Justineo</a> 创作。
    </p>
    <p v-else>
      Made by
      <a href="https://github.com/Justineo">@Justineo</a>.
    </p>
    <p>
      <small v-if="zh">
        本页基于
        <a href="https://picturepan2.github.io/spectre/">Spectre.css</a> 开发。
      </small>
      <small v-else>
        This page is based on
        <a href="https://picturepan2.github.io/spectre/">Spectre.css</a>.
      </small>
    </p>
  </footer>
</article>
</template>

<script>
import VClamp from './components/Clamp'
import qs from 'qs'
import hljs from 'highlight.js/lib/highlight.js'
import vue from './vue-lang.js'
import javascript from 'highlight.js/lib/languages/javascript'
import diff from 'highlight.js/lib/languages/diff'
import shell from 'highlight.js/lib/languages/shell'

hljs.registerLanguage('vue', vue)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('shell', shell)

const search = location.search.replace(/^\?/, '')
const query = qs.parse(search)
const zh = query.lang === 'zh'

export default {
  name: 'app',
  components: {
    VClamp
  },
  data () {
    return {
      lines: 3,
      width1: 600,
      hyphens1: true,
      rtl1: false,
      expanded1: false,
      height: 'calc(48px + 12em)',
      width2: 600,
      hyphens2: true,
      rtl2: false,
      lines3: 5,
      width3: 600,
      hyphens3: true,
      rtl3: false,
      clamped3: false,
      text:
        'Vue (pronounced /vjuː/, like view) is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable. The core library is focused on the view layer only, and is easy to pick up and integrate with other libraries or existing projects. On the other hand, Vue is also perfectly capable of powering sophisticated Single-Page Applications when used in combination with modern tooling and supporting libraries.',
      textZh:
        'Vue (读音 /vjuː/，类似于 view) 是一套用于构建用户界面的渐进式框架。与其它大型框架不同的是，Vue 被设计为可以自底向上逐层应用。Vue 的核心库只关注视图层，不仅易于上手，还便于与第三方库或既有项目整合。另一方面，当与现代化的工具链以及各种支持类库结合使用时，Vue 也完全能够为复杂的单页应用提供驱动。',
      zh,
      pascal: false
    }
  },
  computed: {
    defaultText () {
      return this.zh ? '默认值：' : 'Default:'
    },
    parameterText () {
      return this.zh ? '回调参数：' : 'Callback parameter list:'
    }
  },
  watch: {
    zh (val) {
      if (val) {
        query.lang = 'zh'
      } else {
        delete query.lang
      }
      let search = qs.stringify(query)
      search = search ? `?${search}` : search
      history.pushState(
        null,
        null,
        `${location.origin}${location.pathname}${search}${location.hash}`
      )
    }
  },
  mounted () {
    ;[...this.$el.querySelectorAll('pre.code')].forEach(code => {
      hljs.highlightBlock(code)
    })
  }
}
</script>

<style src="spectre.css/dist/spectre.min.css"></style>
<style src="spectre.css/dist/spectre-exp.min.css"></style>
<style src="highlight.js/styles/atom-one-light.css"></style>

<style lang="stylus">
html
  scroll-behavior smooth

h1
  margin-top 2rem
  align-items center

#lang
  position absolute
  top 0.6rem
  right 0

h2
  margin-top 2rem

article
  position relative
  margin 0 auto
  width 600px

.divider[data-content]
  margin 2rem 0

.form-horizontal
  width 60%

.slider
  height 1.8rem

.demo
  padding 1rem
  background #f8f8f8
  border 1px solid #f1f1f1
  border-radius 2px
  line-height 2

.hyphens
  hyphens auto

.rtl
  direction rtl

.toggle
  margin-left 0.4rem

  .rtl &
    margin-right 0.4rem
    margin-left 0

.featured
  margin-right 0.4rem

  .rtl &
    margin-right 0
    margin-left 0.4rem

ul
  list-style disc outside

  p
    margin-bottom 0.6rem

.hljs
  padding 0

.secondary
  font-size 90%

footer
  margin 6rem 0 3rem
  text-align center

::-webkit-details-marker
  display none

details
  margin-bottom 1em

summary
  display flex
  align-items center
  margin-bottom 0.5em
  cursor pointer

  h4
    margin 0

  &::before
    content ""
    width 0.4rem
    height 0.4rem
    margin-right 0.4rem
    border 2px solid currentColor
    border-style none solid solid none
    transform rotateZ(-45deg)
    transition transform 0.3s
    transform-origin 50% 50%

    details[open] &
      transform rotateZ(45deg)
</style>
