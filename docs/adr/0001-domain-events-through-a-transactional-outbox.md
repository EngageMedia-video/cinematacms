---
status: proposed
---

# Domain events go through a transactional outbox

Notifications, the audit of `/manage/` actions, owner notices for those actions and follower fan-out all react to the same changes. Code that makes a change records a Domain event in the same database transaction, and a Celery worker runs every handler for it at least once (#1143, #1019). Each handler must therefore be idempotent.

## Considered Options

- **Direct calls at each change site** (an earlier #1019 design). Simple for one consumer. With several consumers, every site would call each one, and one consumer's failure would run inside another's request.
- **An in-process dispatcher run after commit** (the first #1019 design). Loses the event if the process dies between commit and dispatch, which an audit consumer cannot accept.
- **Django signals or `post_save`.** These fire on fixtures and admin edits, are skipped by `QuerySet.update()`, and do not know who made the change.
- **A broker such as Kafka or Redis Streams.** New infrastructure, and no consumer outside this Django project needs it.

## Consequences

- Work moved into handlers, such as in-app notifications, appears a few seconds after the request.
- Domain events are transport, not history. An event is deleted a retention period after every handler run for it has ended, either succeeded or failed after its last attempt. Until then a failed run can be replayed, so a worker outage delays handlers but does not drop events. The audit store is separate.
- Analytics events stay in the browser and do not use this outbox.
