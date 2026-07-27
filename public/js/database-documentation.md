1. Review and verify
```bash
npm test -- --runInBand
```

Expected result should be:
```text
23 test suites passed
419 tests passed
```

Start the application:
```bash
npm start
```

Confirm the terminal reports:
```text
MongoDB connected for NODE_ENV=development, database="gems_demo".
```

Then smoke-test for:
- admin login
- /admin/dashboard.html
- student login
- /applications.html
- /documents.html
- verify the existing demo data remains intact

The expected deterministic database should have flows that:
- Leon's TUM application is `nominated` and incomplete.
- UTokyo is `accepted` and incomplete.
- NUS is `submitted` and incomplete.
- KAIST is `rejected/not selected` and incomplete.
- Leon has exactly one unread reminder: "Passport Bio-Page due in 7 days."
- That matches the notification badge displaying `1`.