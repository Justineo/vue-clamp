import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
const workspace = process.cwd(),
  base = resolve(process.argv[2]),
  ucd = resolve(process.argv[3]);
const require = createRequire(workspace + "/tools/benchmark/package.json");
const { createServer } = await import(require.resolve("vite"));
const browsers = require("playwright");
const vectors = [];
for (const version of ["13.0.0", "17.0.0"])
  for (const line of (await readFile(`${ucd}/${version}-GraphemeBreakTest.txt`, "utf8")).split(
    "\n",
  )) {
    const sequence = line.split("#")[0].trim();
    if (!sequence) continue;
    let text = "",
      offsets = [];
    for (const token of sequence.split(/\s+/))
      if (token === "÷") offsets.push(text.length);
      else if (token !== "×") text += String.fromCodePoint(parseInt(token, 16));
    vectors.push({ text, offsets, version });
  }
const ranges = [
  [9, 10],
  [32, 767],
];
const code = String.raw`
import * as before from './baseline/src/text.ts';
import * as bmp from './range/src/text.ts';
const scalar=bmp;
const independentGraphemes=/^[\t\n\x20-\u02ff]*$/u;
const vectors=VECTORS,ranges=RANGES;
const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'}),words=new Intl.Segmenter(undefined,{granularity:'word'});
const alphabet=[];for(const [start,end] of ranges)for(let cp=start;cp<=end;cp++)alphabet.push(String.fromCodePoint(cp));
const cases=vectors.map(v=>v.text); for (const ch of alphabet) cases.push('A'+ch+ch+'Z', '\u02e5'+ch+'\u02e9', 'é'+ch+'œ');
for(let start=0;start<alphabet.length;start+=128)cases.push(alphabet.slice(start,start+128).join(''));
const extra=['\r\n','\u0301','\u200d','\uFE0F','\u{E0100}','👩🏽‍💻','🇨🇳','\uD800','\uDC00','\u0600','\u0903','\u1100','\u1161','\u11a8','\u0d4e','\u0e33','\uff9e','क्ष','\u0300','\u02ff\u0300','\u02e5\u02e9','\u02e9\u02e5','\u2019','\u00ad'];
let seed=335;const next=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
for(let n=0;n<1000;n++){let s='';for(let j=0;j<48;j++)s+=(n%2&&next()%8===0)?extra[next()%extra.length]:alphabet[next()%alphabet.length];cases.push(s);}
function equal(a,b,label){if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+' '+JSON.stringify({a,b}));}
window.run=()=>{
 let checked=0, normative=0;
 for(const vector of vectors)if(independentGraphemes.test(vector.text)){equal(scalar.prepareText(vector.text).boundaryOffsets,vector.offsets,'UAX '+vector.version);normative++;}
 for(const text of cases){
  const fallback=[0,...Array.from(graphemes.segment(text),s=>s.index+s.segment.length)];const word=[0,...Array.from(words.segment(text),s=>s.index+s.segment.length).filter(end=>fallback.includes(end))];
  if(word.at(-1)!==text.length)word.push(text.length);
  const cursive=/[\p{Script_Extensions=Arabic}\p{Script_Extensions=Syriac}]/u.test(text);
  for(const target of [bmp])for(const boundary of ['word','grapheme'])for(const prepare of [target.prepareText,target.prepareSharedText]){
   const p=prepare(text,boundary);equal(p.boundaryOffsets,boundary==='word'?word:fallback,'offset '+JSON.stringify(text));if(boundary==='word')equal(p.fallbackBoundaryOffsets,fallback,'fallback');equal(p.hasCursiveText,cursive,'cursive');checked++;
  }
 }
 return {cases:cases.length,checked,normative,admitted:alphabet.length};
};
window.ready=true;
`
  .replace("VECTORS", JSON.stringify(vectors))
  .replace("RANGES", JSON.stringify(ranges));
await writeFile(base + "/runtime.js", code);
await writeFile(base + "/index.html", '<script type="module" src="/runtime.js"></script>');
const server = await createServer({
  root: base,
  configFile: false,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, fs: { allow: [workspace, base] } },
});
await server.listen();
try {
  for (const name of ["chromium", "firefox", "webkit"]) {
    const paths = Object.fromEntries(
      ["chromium", "firefox", "webkit"].map((name) => [
        name,
        process.env["VUE_CLAMP_" + name.toUpperCase() + "_PATH"],
      ]),
    );
    const browser = await browsers[name].launch(paths[name] ? { executablePath: paths[name] } : {});
    try {
      const page = await browser.newPage();
      page.on("pageerror", (e) => console.error(e));
      await page.goto(server.resolvedUrls.local[0]);
      await page.waitForFunction(() => window.ready);
      console.log(
        JSON.stringify({
          browser: name,
          version: browser.version(),
          oracle: await page.evaluate(() => window.run()),
        }),
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
