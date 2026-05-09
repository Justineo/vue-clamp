# Website compile-time highlighting

## 2026-05-09

- Replaced runtime Shiki loading with a Vite plugin that generates highlighted HTML at build/dev
  transform time.
- Added a shared install-command module so runtime copy text and build-time highlighted install
  commands use the same source strings.
- Verified the production website build no longer emits the previous large `highlight-*.js` chunk;
  highlighted HTML now adds a small amount to the main entry instead of shipping Shiki runtime code.
