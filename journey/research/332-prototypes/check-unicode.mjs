import { createRequire } from "node:module";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
if (process.argv.length < 4) throw new Error("Pass baseline and candidate package directories.");
const workspace = process.cwd();
const baseline = resolve(process.argv[2]);
const candidate = resolve(process.argv[3]);
const require = createRequire(workspace + "/tools/benchmark/package.json");
const { createServer } = await import(require.resolve("vite"));
const browsers = require("playwright");
const directory = await mkdtemp(join(tmpdir(), "vue-clamp-unicode-332-"));
const code = String.raw`
import {prepareText as base, prepareSharedText as baseDeferred} from ${JSON.stringify("/@fs" + join(baseline, "src/text.ts"))};
import {prepareText as candidate, prepareSharedText as candidateDeferred} from ${JSON.stringify("/@fs" + join(candidate, "src/text.ts"))};
let seed=332;
const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
const alphabet=[...Array.from({length:95},(_,i)=>String.fromCharCode(32+i)),'\t','\n','、','。','，'];
for(let code=0x3400;code<=0x4dbf;code++)alphabet.push(String.fromCharCode(code));
for(let code=0x4e00;code<=0x9fff;code++)alphabet.push(String.fromCharCode(code));
const cases=[alphabet.join(''),'', '中\uFE0F文','中\u{E0100}文','\r\n','a\u0301','👩🏽‍💻','🇨🇳🇺🇸','漢字かなカナ한국어','مرحبا بالسريانية ܐܒܓ','\uD800','\uDC00'];
const extra=['\r','\u0301','\u200d','\uFE0F','\u{E0100}','👩🏽‍💻','🇨🇳','\uD800','\uDC00','\u0600','\u0903','\u1100','\u1161','\u11a8'];
for(let n=0;n<500;n++){
 let s='';const length=10+next()%150;
 for(let i=0;i<length;i++)s+=(n%2&&next()%8===0)?extra[next()%extra.length]:alphabet[next()%alphabet.length];
 cases.push(s);
}
function snapshot(p){return JSON.stringify({text:p.text,boundary:p.boundary,offsets:p.boundaryOffsets,fallback:p.fallbackBoundaryOffsets,cursive:p.hasCursiveText});}
window.run=()=>{
 let checked=0;
 for(const text of cases)for(const boundary of ['word','grapheme'])for(const [before,after] of [[base,candidate],[baseDeferred,candidateDeferred]]){
  if(snapshot(before(text,boundary))!==snapshot(after(text,boundary)))throw new Error('Boundary mismatch '+JSON.stringify({text,boundary,checked}));
  checked++;
 }
 const actual=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(cases[0])];
 if(actual.length!==cases[0].length||actual.some(part=>part.segment.length!==1))throw new Error('Admitted character is not one unit');
 return {cases:cases.length, comparisons:checked, admittedCharacters:cases[0].length};
};
window.ready=true;
`;
await writeFile(join(directory, "runtime.js"), code);
await writeFile(join(directory, "index.html"), '<script type="module" src="/runtime.js"></script>');
const server = await createServer({
  root: directory,
  configFile: false,
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 0,
    fs: { allow: [workspace, baseline, candidate, directory] },
  },
});
await server.listen();
try {
  for (const name of ["chromium", "firefox", "webkit"]) {
    const paths = {
      firefox: process.env.FIREFOX_EXECUTABLE,
      webkit: process.env.WEBKIT_EXECUTABLE,
    };
    const browser = await browsers[name].launch(paths[name] ? { executablePath: paths[name] } : {});
    try {
      const page = await browser.newPage();
      await page.goto(server.resolvedUrls.local[0]);
      await page.waitForFunction(() => window.ready);
      console.log(
        JSON.stringify({
          browser: name,
          version: browser.version(),
          ...(await page.evaluate(() => window.run())),
        }),
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
