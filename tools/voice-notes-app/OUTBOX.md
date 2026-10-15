# Replying from Claude: the Outbox

Claude (in Claude Code or chat) can answer leads without opening the app. Airtable is the shared mailbox.

## Reading what leads said
- **Email replies** are copied into the lead's **Last reply**, **Reply received** and **Gmail thread ID** by the Make scenario `TL5b` (Status becomes `Replied`).
- **Instagram replies** are written to **Last reply**, **Reply intent** and **Suggested reply** by the Torrey Voice Notes app, but only while the app is open and *Setup > Airtable > write back* is on.

### The whole thread, and whether the app is alive
- **Conversation** (Leads): the Instagram thread as the app last read it ("Them:" / "Us:", oldest first), updated each time a reply is read or sent. Read-only for Claude.
- **App status** (its own table, one row): Build, Last seen, Last reply check, Replies waiting, Sent today, Queued, Auto-reply, Note. The app updates it every 5 minutes while open. If **Last seen** is old, the app is closed or the Mac is asleep, and nothing is being read or sent.

### How autonomous the app is
The app answers Instagram replies on its own, after the delay in Setup > Auto-reply, whenever Claude is sure: a yes or a question gets the answer plus the lead's partner code; anything unclear gets a short reply with no code. Claude marks a draft **Needs you** (and it waits under Replies) when it would have to guess, or the message is about dosing or health, is upset, asks for a custom deal, or anything risky. Prices, minimums and other facts go in Setup > Auto-reply > "Facts Claude can use", and Claude treats them as true.

### Cold DMs on their own
With **Setup > Sending > "Send a personalized text DM to the next lead by itself"** on (the default), the app, while open, sends a short text DM to the next To-do lead about once every few minutes, inside the daily/hourly limits, the 8 AM to 8 PM Pacific window and the warm-up ramp, and at most "Most cold DMs a day" (20). It needs the Claude key and "Send the voice note for me" on. Claude writes each message from what Airtable knows about the lead (one true detail, who we are, high quality peptides at competitive prices, the open store, the affiliate program, a yes/no question, no link); anything with a link, a phone number or a health claim is replaced by a plain message. A chat that already has messages in it is never messaged: the lead is filed as Sent. Three failures in a row pause the queue for 30 minutes. A "yes" is answered with the store link with prices, the affiliate details and the lead's code.

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
