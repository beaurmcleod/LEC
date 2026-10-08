# Replying from Claude: the Outbox

Claude (in Claude Code or chat) can answer leads without opening the app. Airtable is the shared mailbox.

## Reading what leads said
- **Email replies** are copied into the lead's **Last reply**, **Reply received** and **Gmail thread ID** by the Make scenario `TL5b` (Status becomes `Replied`).
- **Instagram replies** are written to **Last reply**, **Reply intent** and **Suggested reply** by the Torrey Voice Notes app, but only while the app is open and *Setup > Airtable > write back* is on.

## Writing a reply
On the lead's row in Airtable (Leads table) set:

| Field | Value |
|---|---|
| **Outbox** | The message to send, plain text, signed by the sender. |
| **Outbox via** | `Email` or `Instagram` |
| **Outbox status** | `Ready to send` |

**Email** is sent by the Make scenario `TL6 · Outbox → send as Garrett`, every 15 minutes, from garrett@torreylabshq.com. It replies inside the lead's Gmail thread when **Gmail thread ID** is set, otherwise it sends a new email using **Email subject**. It then sets **Outbox status** = `Sent`, **Outbox sent at**, and ticks **Reply handled**. A failure sets `Failed` and adds a line to **Notes**.

**Instagram** is picked up by the app (once a minute, while it is open). The message appears under **Replies** as a draft, the row becomes `In app`, and nothing is sent until a person presses **Send**. After it goes out the row becomes `Sent`; **Mark handled** makes it `Dismissed`. The lead must already be in the app (Sync from Airtable first).

## Notes
- One Outbox message per lead at a time. Write a new one only after the status is `Sent` or `Dismissed`.
- Email replies go out without a human click. Check the text and the address before setting `Ready to send`.
- The app never reads or sends Instagram messages any other way.
