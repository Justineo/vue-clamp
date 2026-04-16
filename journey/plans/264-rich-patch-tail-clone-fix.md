# 264 Rich patch tail clone fix

## Goal

Fix the remaining rich structural patch inefficiency where candidate patches still clone the full
source prefix before appending only the changed suffix.

## Scope

- Build patch fragments from the shared patch anchor directly.
- Avoid cloning unchanged prefix descendants, especially `<img>` nodes.
- Add benchmark visibility for image clone churn so `replaceChildren` is not the only DOM churn signal.
- Preserve the current hidden-probe and visible structural decision model.
