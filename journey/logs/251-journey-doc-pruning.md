# 2026-04-11 Journey doc pruning

- Read `journey/design.md` to anchor the review on the current Vue 3 package surface and runtime split.
- Started a file-by-file pass to keep only design-relevant history and remove routine-only plan/log entries.
- Retention rule used for the full pass:
  - keep entries that still explain the shipped API, runtime model, benchmark-backed trade-offs, or current repo standards
  - keep research and review notes that still support current decisions
  - remove routine release/PR task records, superseded intermediate experiments, website-only polish churn, and trivial cleanup-only notes
- Tracked `HEAD` baseline for the deleted set:
  - `252` plan files
  - `43` log files
  - `9` research files
  - `1` review file
  - `1` prompt file
- Tracked pruning result:
  - deleted `202` tracked journey files from `HEAD`
  - deleted `178` tracked plan files
  - deleted `23` tracked log files
  - deleted the `1` tracked prompt file
  - kept all tracked research and review files
- Follow-up validation re-read all `202` deleted tracked files from `HEAD` in full and restored `0` files.
- Current on-disk journey corpus after pruning and the follow-up validation records:
  - `76` plan files
  - `76` log files
  - `9` research files
  - `1` review file
  - `0` prompt files
- Updated `AGENTS.md` so future sessions only write journey entries for non-trivial work and stop recording routine transactional tasks by default.

## 2026-04-17 content pass

- Re-read retained journey content rather than pruning by filename or title.
- Compared the retained files against the updated `AGENTS.md` memory policy and the current
  `journey/design.md` snapshot.
- Second-pass retention rule:
  - keep research and review notes whose body still carries background findings
  - keep logs with durable architecture decisions, benchmark numbers, root causes, or current
    runtime/API contracts
  - keep only the one completed plan that still contains the detailed `RichLineClamp` architecture
    option analysis
  - remove completed route-map plans, process-only implementation logs, deployment/release/website
    task records already captured in `design.md`, and superseded rich image-settlement notes
- Additional pruning result:
  - reduced the on-disk journey corpus from `203` files to `54` files
  - retained `40` logs, `1` plan, `11` research notes, `1` review, and `design.md`
  - removed the superseded `RichLineClamp` generation-settlement research draft after the explicit
    image-size contract replaced that design
