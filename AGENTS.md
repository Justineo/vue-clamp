<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.

<!--VITE PLUS END-->

## Journey memory

Use `journey/` as the shared project memory across agent sessions.

- Read `journey/design.md` first at the start of each session. It is the canonical snapshot of the project: current strategy, key design decisions, trade-offs, constraints, and scope.
- Use `journey/research/` for durable research notes, background findings, benchmark summaries, and decision evidence that is too detailed for `design.md`.
- Use `journey/logs/` only for meaningful process records where the sequence matters: benchmark
  comparisons, failed paths that explain why an option was rejected, migration evidence, or
  non-obvious operational lessons.
- Update `journey/design.md` whenever the effective understanding of the project changes. Do not leave important decisions or trade-offs only in logs.
- Keep `journey/logs/` distinct from `journey/design.md` and `journey/research/`: do not duplicate
  the current design snapshot or long-form research. Log only the process evidence needed to
  understand how a decision was reached.
- Do not commit command transcripts, status updates, validation checklists, or step-by-step
  implementation diaries to tracked journey files.
- If temporary planning notes or logs are useful during the task, write them as
  `journey/**/*.local.md`; this suffix is ignored by Git and means the file is local scratch
  memory, not a repo artifact.
- Before finishing, fold durable conclusions into `journey/design.md`, `journey/research/`, or a
  concise tracked `journey/logs/` entry, then leave ignored scratch files uncommitted.
- Commit journey entries only when they change architecture, public API, runtime behavior, testing strategy, deployment/repo standards, or preserve decision/process evidence that future sessions would reasonably need to recover.
- Do not create or update journey plans/logs for routine or transactional tasks such as drafting a PR, making a commit, pushing a branch, minor copy edits, formatting-only changes, dependency bumps, CI retries, or other maintenance.

For any new project, planning-focused request, or sufficiently complex non-trivial task, write a plan in chat first. Create a repo-tracked journey plan only if the plan itself contains durable architecture or product decisions that should survive beyond the task. If a temporary file is helpful, use a `journey/**/*.local.md` filename so Git decides that it is not a repo artifact.

## Release writing preferences

- Use conventional commits for new commit messages, e.g. `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `style: ...`, or `perf: ...`.
- Write changelog entries from the library user's point of view: observable behavior,
  compatibility, upgrade cost, performance, or reliability.
- Omit internal mechanics, file names, tests, benchmark tooling, and investigation history unless
  users must act on them.
- Keep entries short. For performance notes, name the affected component/scenario and include
  numbers only when they clarify user impact.
- Use sentence case for changelog headings.

## Pull request writing preferences

- Keep PR descriptions concise.
- Prefer structured sections with short bullets over long descriptive paragraphs.
- Do not include validation or test command lists by default unless explicitly requested.
- Summarize the reviewer-relevant changes and the main design considerations behind them.
- Avoid implementation diary details unless they explain a public API change, migration concern, or important trade-off.
