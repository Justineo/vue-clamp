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
- Use `journey/logs/` for chronological process notes, progress, experiments, and failed paths.
- Use `journey/research/` for research notes and background findings.
- Update `journey/design.md` whenever the effective understanding of the project changes. Do not leave important decisions or trade-offs only in logs.
- Record only non-trivial work in `journey/`.
- Do not create or update journey plans/logs for routine or transactional tasks such as drafting a PR, making a commit, pushing a branch, minor copy edits, formatting-only changes, dependency bumps, or other trivial maintenance unless they change the design snapshot or capture a reusable decision.
- Prefer journey entries for work that changes architecture, public API, runtime behavior, testing strategy, deployment/repo standards, or other decisions that future sessions would reasonably need to recover.

For any new project, planning-focused request, or sufficiently complex non-trivial task, start with a fresh plan and write it to `journey/plans/{index}-{title}.md` before implementing. Treat files in `journey/plans/` as the canonical plans. As work progresses, record concise updates in `journey/logs/{index}-{title}.md` using the same date and title convention. In chat, provide only a brief summary and the relevant file path(s). `index` should be padded with zeros for proper sorting, e.g. `001`, `002`, etc.

## Release writing preferences

- Use conventional commits for new commit messages, e.g. `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `style: ...`, or `perf: ...`.
- Keep changelog entries simple and user-facing. Write from first principles: what should a library user know to upgrade, adopt, or use the release.
- Do not expose implementation details in changelog entries unless they create a direct user-visible requirement or migration step.
- Use sentence case for changelog headings.
