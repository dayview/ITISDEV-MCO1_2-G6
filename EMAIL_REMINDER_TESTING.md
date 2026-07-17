## If you want to test the email feature, please follow these steps.

EMAIL_NOTIFICATIONS_ENABLED=true<br/>
DEADLINE_REMINDER_EMAIL_MAX_ATTEMPTS=3<br/>
SMTP_HOST=smtp.gmail.com<br/>
SMTP_PORT=465<br/>
SMTP_SECURE=true<br/>
SMTP_USER=your.test.sender@gmail.com (example: firstname.lastname@dlsu.edu.ph / testuser@gmail.com)
SMTP_PASS=<generate via Google App Passwords site><br/>
EMAIL_FROM=GEMS Deadline Reminders your.test.sender@gmail.com<br/>
APP_BASE_URL=http://localhost:3000<br/>

**Use a dedicated Gmail sender account. Gmail app passwords require two-step verification and are 16-digit passcodes; create one in your Google Account, then keep it only in `.env`.**<br/>

Restart the server after saving `.env`:
```bash
npm run dev
```

Then set up one test case in MongoDB Compass:
1. In the `applications` collection, find an active application:
```js
{
    status: { $in: ["draft", "submitted", "under-review", "nominated"] }
}
```

Copy its `userId` and `opportunityId`.
2. In `users`, find that `userId`. For testing, set the email to an inbox you can access:
```js
{
    $set: {
        email: "your.personal.test.inbox@gmail.com"
    }
}
```

3. In `opportunities`, find the copied `opportunityId` and update it:
```js
{
    $set: {
        status: "published",
        deadline: ISODate("2026-07-21T04:00:00.000Z"),
        requiredDocumentTypes: ["passport"]
    }
}
```

4. In `documents`, check this user's Passport:
```js
{
    userId: ObjectId("PASTE_THE_USER_ID"),
    type: "passport"
}
```
If no record appears, that is perfect -- it's expected that the passport is missing.
However, if a record exists, update it to make it incomplete:
```js
{
    $set: {
        status: "pending"
    }
}
```

5. In `notifications`, delete any old reminders for this test application so you create a fresh notification and email. Do this only in the dedicated feature database:
```js
{
    applicationId: ObjectId("PASTE_THE_APPLICATION_ID")
}
```
Use Delete Many with that filter.

6. Sign in as admin, open browser Developer Tools -> Console, and run:
```js
fetch('/api/admin/reminders/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
})
    .then(async response => ({
        status: response.status,
        body: await response.json()
    }))
    .then(console.log)
    .catch(console.error);
```

Expected summary should be:
```text
eligibleApplications: 1
createdReminders: 1
emailsSent: 1
```

Then verify:
- Bell badge shows one unread reminder.
- Your test inbox receives the GEMS deadline email; check Spam/Junk too.
- In Compass, the new `notifications` record has:
```js
emailStatus: "sent"
emailAttempts: 1
emailSentAt: <date>
```

If Gmail returns `535` or "username/password not accepted," verify the app password, and it should not be your normal Gmail password.

Alternative way:
You only need to provide an email inbox you can open, preferably a separate test Gmail address. Do not send or share your Gmail password or App Password.
The setup has two distinct email addresses:
- `SMTP_USER`: Gmail account that sends the reminder
- User document `email`: inbox that receives the reminder.

Use this exact test data in MongoDB Compass's built-in MongoDB Shell:
```js
use gems_automated_reminders_dev

db.users.updateOne(
    { _id: ObjectId("6a58fd0c0f0e65fb54174cf9") },
    { $set: { email: "YOUR_ACCESSIBLE_TEST_INBOX@gmail.com" } }
)

db.opportunities.updateOne(
    { _id: ObjectId("6a58fd0b0f0e65fb54174ced") },
    { $set: { deadline: ISODate("2026-07-21T04:00:00.000Z") } }
)
```
Make sure to replace only `YOUR_ACCESSIBLE_TEST_INBOX@gmail.com`.

This created the intended condition:
- NUS Student Exchange is published.
- Its deadline is three calendar days away.
- <user>'s submitted application is incomplete.
- The generated email goes to your chosen test inbox.

Your local `.env` must contain the sender configuration, never commit this file or its secrets:
```env
MONGO_URI=your dedicated gems_automated_reminders_dev URI

EMAIL_NOTIFICATIONS_ENABLED=true
DEADLINE_REMINDER_EMAIL_MAX_ATTEMPTS=3

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your.sender.gmail@gmail.com
SMTP_PASS=your_16_character_Gmail_app_password
EMAIL_FROM=GEMS Deadline Reminders <your.sender.gmail@gmail.com>

APP_BASE_URL=http://localhost:3000
```

Then restart the server:
```bash
npm run dev
```

Finally, while logged in as an admin, run in browser DevTools:
```js
fetch('/api/admin/reminders/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
  .then(async response => ({ status: response.status, body: await response.json() }))
  .then(console.log)
  .catch(console.error);
```

Expected result:
```js
eligibleApplications: 1
createdReminders: 1
emailsSent: 1
```

Then check:
- Your test inbox for the NUS deadline reminder.
- The bell notification in the student UI.
- `notifications` in Compass for `emailStatus: "sent"` and `emailSentAt`.

If it says `createdReminders: 1` but `emailsSent: 0`, it is a likely SMTP problem.