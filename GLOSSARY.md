# Cinemata

Cinemata is a video platform for Asia-Pacific social issue films. This glossary fixes the words used for its media, people and notifications.

## Media and people

**Media**:
An item a user uploads to Cinemata: a video, audio file, image or document.
_Avoid_: Film (outside interface text), video, upload

**Owner**:
The user a Media belongs to.
_Avoid_: Uploader, creator, filmmaker

**Staff**:
Users who hold the manager or editor role. Curators and superusers without one of those roles are not Staff.
_Avoid_: Admins, moderators

**Visibility**:
Who may see a Media: public, unlisted, restricted or private. Review decisions and encoding are not part of it.
_Avoid_: State, status, privacy

**Listed**:
A Media that currently appears in public listings: its Visibility is public, it is reviewed, and it is fully encoded.
_Avoid_: Live, visible

**Published**:
The first time a Media becomes Listed. It happens at most once per Media; leaving and re-entering the listings later is not publishing.
_Avoid_: Made public, went live

**Follow**:
A user's choice to hear about another user's new Media. The user who follows is a **Follower**.
_Avoid_: Subscribe, subscription, subscriber

## Changes and notifications

**Domain event**:
A record that a change happened in Cinemata, written together with the change itself.
_Avoid_: Event (unqualified), signal

**Analytics event**:
A visitor action the browser reports to the analytics service.
_Avoid_: Event (unqualified), tracking event

**Actor**:
The user who made a change. A change made by the system, such as a schedule or a report threshold, has no Actor and counts as made by someone else.
_Avoid_: Sender, triggerer

**Notification**:
A message to one Recipient about one Domain event. One Domain event can produce none, one or many Notifications.
_Avoid_: Alert, message (unqualified)

**Recipient**:
The user a Notification is for.
_Avoid_: Target, receiver

**Confirmation**:
A Notification to the Actor about their own change, such as the receipt for their own upload. It is the only Notification an Actor gets about their own change.
_Avoid_: Receipt, self-notification

**Delivery channel**:
A way a notification reaches its recipient: in-app, email or push.
_Avoid_: Channel (unqualified), medium
