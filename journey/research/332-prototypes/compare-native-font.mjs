import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const workspace = process.cwd(),
  base = process.env.EXPERIMENT_ROOT;
if (!base)
  throw new Error("Set EXPERIMENT_ROOT to the directory containing built package targets.");
const require = createRequire(join(workspace, "tools/benchmark/package.json"));
const packageRequire = createRequire(join(workspace, "packages/vue-clamp/package.json"));
const { createServer } = await import(require.resolve("vite"));
const { chromium } = require("playwright");
const names = (process.env.TARGETS ?? "baseline,combined,control").split(",");
const scenarios = (
  process.env.SCENARIOS ??
  "font-line,font-line-height,font-rich,font-line-metrics,font-rich-metrics"
).split(",");
const counts = (process.env.COUNTS ?? "1,20").split(",").map(Number);
const rounds = Number(process.env.ROUNDS ?? 8),
  steps = Number(process.env.STEPS ?? 12),
  metrics = process.env.METRICS === "1";
const directory = join(base, process.env.RESULT_NAME ?? "variant-comparison");
await mkdir(directory, { recursive: true });
const aliases = {
  vue: require.resolve("vue/dist/vue.runtime.esm-bundler.js"),
  "@chenglou/pretext": packageRequire.resolve("@chenglou/pretext"),
};
const imports = [];
for (let i = 0; i < names.length; i++) {
  aliases["candidate-" + i] = join(
    base,
    names[i] === "control" ? "baseline" : names[i],
    "dist/index.js",
  );
  imports.push("import * as target" + i + ' from "candidate-' + i + '";');
}
const runtime =
  imports.join("\n") +
  String.raw`
import {createApp,defineComponent,h,ref,nextTick} from 'vue';
const targets=[` +
  names.map((_, i) => "target" + i).join(",") +
  String.raw`];
const frame=()=>new Promise(requestAnimationFrame);
const channel=new MessageChannel();let completeTask;channel.port1.onmessage=()=>completeTask?.();const task=()=>new Promise(r=>{completeTask=r;channel.port2.postMessage(0);});
const flush=async()=>{await nextTick();await nextTick();await nextTick();await task();};
const copies={cjk:'这是一个需要在不同宽度下保持正确文字边界的组件。中英文混排 dashboard 让我们验证真实浏览器的排版行为。',latin:'Operational dashboards keep ownership and incident context visible while surrounding panels change width. ',emoji:'👨‍👩‍👧‍👦 family 👩🏽‍💻 developer 🇨🇳 flag ❤️ heart café élan dashboard '};
let mounted;
window.prepare=async(target,scenario,count)=>{
 if(mounted){mounted.app.unmount();mounted.container.remove();await flush();await frame();}
 const entry=targets[target],width=ref(scenario.includes('tiny')?64:300),revision=ref(0),itemWidth=ref(42);
 const kind=scenario.includes('inline')?'inline':scenario.includes('rich')?'rich':scenario.includes('wrap')?'wrap':'line';
 const Component=entry[{line:'LineClamp',inline:'InlineClamp',rich:'RichLineClamp',wrap:'WrapClamp'}[kind]];
 const sourceKind=scenario.includes('cjk')?'cjk':scenario.includes('emoji')?'emoji':'latin';
 const copy=copies[sourceKind],length=scenario.includes('large')?6000:600;
 const source=scenario.includes('full')?'Short title':copy.repeat(Math.ceil(length/copy.length)).slice(0,length);
 const items=Array.from({length:scenario.includes('tiny')?400:60},(_,i)=>({id:i,label:scenario.includes('tiny')?'':'Item '+i,width:i%2?3:5}));
 const container=document.createElement('div');document.body.append(container);
 const App=defineComponent({setup:()=>()=>h('div',{},Array.from({length:count},(_,i)=>{
  const text=(scenario.startsWith('source')?revision.value+': ':'')+(scenario.includes('distinct')?i+': ':'')+source;
  const style={display:'block',width:width.value+'px',fontFamily:'var(--font-family,Arial)',fontSize:'var(--font-size,16px)',lineHeight:'24px'};
  const props={key:i,style,title:String(revision.value),boundary:'word'};
  if(kind==='rich')props.html=scenario.includes('plain')?text:'<strong>Release </strong><em class="main-leaf">'+text+'</em>';
  else if(kind==='wrap')props.items=items;
  else props.text=text;
  if(kind==='inline')props.location='middle';else if(scenario.includes('height'))props.maxHeight=48;else props.maxLines=scenario.includes('full')?20:3;
  const slots=kind==='wrap'?{item:({item})=>h('span',{style:{display:'inline-block',width:scenario.includes('natural')?undefined:(scenario.includes('tiny')?item.width:itemWidth.value)+'px',height:scenario.includes('tiny')?'16px':undefined,font:scenario.includes('natural')?'12px var(--font-family,Arial)':'12px Arial'}},item.label)}:scenario.includes('affix')?{after:()=>h('span',{style:{display:'inline-block',width:'48px'}},'More')}:undefined;
  return h(Component,props,slots);
 }))});
 const app=createApp(App);app.mount(container);await flush();await frame();await frame();await flush();
 mounted={app,container,width,revision,itemWidth,scenario};
};
window.runNative=async(steps)=>{
 const {container,scenario}=mounted;let trustedEvents=0;const listener=e=>{if(e.isTrusted)trustedEvents++;};document.fonts.addEventListener('loadingdone',listener);
 const outputs=[];const start=performance.now();
 for(let i=0;i<steps;i++){
  const family='ResearchNative'+i,face=new FontFace(family,i%2?'local(Arial)':'local(Courier New)');
  document.fonts.add(face);container.style.setProperty('--font-family',family+',Arial');await face.load();await document.fonts.ready;
  await frame();await frame();await frame();await flush();
  outputs.push([...container.firstElementChild.children].map(root=>root.outerHTML));
  container.style.removeProperty('--font-family');document.fonts.delete(face);await frame();await frame();await flush();
 }
 document.fonts.removeEventListener('loadingdone',listener);
 if(trustedEvents!==steps)throw new Error('Expected native font events, got '+trustedEvents);
 return {ms:performance.now()-start,outputs,trustedEvents};
};
window.run=async(steps)=>{
 if(mounted.scenario.startsWith('fontnative'))return window.runNative(steps);
 const {container,width,revision,itemWidth,scenario}=mounted;const outputs=[];let ms=0;
 for(let i=0;i<steps;i++){
  let start;
  if(scenario.startsWith('font')){
   await new Promise(resolve=>requestAnimationFrame(()=>{
    start=performance.now();
    if(scenario.includes('metrics'))container.style.setProperty('--font-size',i%2?'16px':'20px');
    document.fonts.dispatchEvent(new Event('loadingdone'));
    requestAnimationFrame(resolve);
   }));
   await flush();
  }else{
   start=performance.now();
   if(scenario.startsWith('source')||scenario.startsWith('noop'))revision.value++;
   else if(scenario.startsWith('item'))itemWidth.value=i%2?42:30;
   else width.value=(scenario.includes('tiny')?[1200,64,900,120,480,64,800,160,1200,96,600,64]:[280,260,220,180,250,330,300,190,360,240,320,210])[i%12];
   await flush();
  }
  ms+=performance.now()-start;
  await frame();await flush();
  outputs.push([...container.firstElementChild.children].map(root=>root.outerHTML));
 }
 return {ms,outputs};
};
window.checkRuntime=()=>{let warnings=0;const old=console.warn;console.warn=()=>warnings++;const app=createApp(defineComponent({props:{sample:{type:String,required:true}},render:()=>h('span')}),{sample:42});app.mount(document.createElement('div'));app.unmount();console.warn=old;return warnings;};
window.ready=true;
`;
await writeFile(join(directory, "runtime.js"), runtime);
await writeFile(join(directory, "index.html"), '<script type="module" src="/runtime.js"></script>');
process.env.NODE_ENV = "production";
const server = await createServer({
  root: directory,
  configFile: false,
  logLevel: "error",
  define: {
    "process.env.NODE_ENV": '"production"',
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: { alias: aliases, dedupe: ["vue"] },
  optimizeDeps: {
    include: ["vue"],
    esbuildOptions: { define: { "process.env.NODE_ENV": '"production"' } },
  },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [workspace, base] } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => {
    if (!e.message.includes("ResizeObserver loop")) errors.push(e.message);
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.ready);
  if (await page.evaluate(() => window.checkRuntime())) throw new Error("Development Vue");
  const cdp = metrics ? await page.context().newCDPSession(page) : null;
  if (cdp) await cdp.send("Performance.enable");
  const rows = [];
  const metricKeys = [
    "LayoutCount",
    "LayoutDuration",
    "RecalcStyleCount",
    "RecalcStyleDuration",
    "ScriptDuration",
    "TaskDuration",
  ];
  for (const count of counts)
    for (const scenario of scenarios) {
      let reference;
      for (let round = -1; round < rounds; round++)
        for (let order = 0; order < names.length; order++) {
          const target = (order + Math.max(0, round)) % names.length;
          await page.evaluate(([t, s, c]) => window.prepare(t, s, c), [target, scenario, count]);
          const before = cdp ? await cdp.send("Performance.getMetrics") : null;
          const result = await page.evaluate((n) => window.run(n), steps);
          const after = cdp ? await cdp.send("Performance.getMetrics") : null;
          const output = JSON.stringify(result.outputs);
          if (reference && reference !== output) {
            await writeFile(
              join(directory, "mismatch.json"),
              JSON.stringify(
                {
                  scenario,
                  count,
                  target: names[target],
                  expected: JSON.parse(reference),
                  actual: result.outputs,
                },
                null,
                2,
              ),
            );
            throw new Error("Output mismatch " + scenario + "/" + names[target]);
          }
          reference = output;
          delete result.outputs;
          if (round < 0) continue;
          const metricValues = after
            ? Object.fromEntries(
                metricKeys.map((key) => [
                  key,
                  after.metrics.find((x) => x.name === key).value -
                    before.metrics.find((x) => x.name === key).value,
                ]),
              )
            : {};
          const row = { scenario, count, round, target: names[target], ...result, ...metricValues };
          rows.push(row);
          console.log(JSON.stringify(row));
        }
    }
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    join(directory, "results.json"),
    JSON.stringify(
      { browser: browser.version(), names, scenarios, counts, rounds, steps, metrics, rows },
      null,
      2,
    ),
  );
  console.log("Results:", join(directory, "results.json"));
} finally {
  await browser?.close();
  await server.close();
}
