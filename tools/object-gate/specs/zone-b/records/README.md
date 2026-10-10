# Checklist records

One `<object id>.verified.yaml` per object: a pass/fail per checklist item, who verified it, and the dHash of each
capture it was judged on (copy from the gate's `checklist-todo.yaml`). No file = nothing verified = the gate FAILS the
`key checklist` row. A new build that changes a capture invalidates the pass automatically.
