---
status: proposed
---

# Media visibility, review and encoding change only through domain operations

A Media's Visibility, review and encoding decide whether it is Listed and when it is Published, and every change to them must record a Domain event with the right Actor. These three fields change only through a small set of domain operations that take the Actor as an argument (`None` for the system), check the Listed and Published transitions, and record the Domain event in the same transaction. Django admin (`MediaAdmin.save_model`), `/manage/` (including bulk changes, one Media at a time), the edit forms and the Celery tasks all call these operations. A CI check fails on any other assignment to the three fields.

## Considered Options

- **Detect transitions in `Media.save()` and read the Actor from a request-scoped context.** Nothing can be missed except `QuerySet.update()`, but the model would depend on the request, the Actor would be an invisible global, and management commands, the shell and eager tasks in tests would get the wrong Actor.
- **Call a recording function after each existing change.** Keeps today's code, but about twelve sites must each remember the call, and a missed one loses events silently.

## Consequences

- `QuerySet.update()` can no longer change these fields; bulk changes loop over the operations.
- About twelve existing sites move onto the operations (edit forms, review action, schedule and report tasks, encoding, draft handling, model methods, admin, `/manage/` bulk state).
