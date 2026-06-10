
## Notes Setup (Google Sheets as Database)

Notes are saved per metric row to a Google Sheet you control.

### 1. Create the Notes Sheet
- Go to Google Sheets and create a new spreadsheet
- Name it "LO Dashboard Notes"
- In row 1, add these headers: `Timestamp` | `Program` | `MetricId` | `Note`
- Save the sheet and copy the Sheet ID from the URL:
  `https://docs.google.com/spreadsheets/d/**SHEET_ID**/edit`

### 2. Share with service account
- Click Share in the notes sheet
- Add `scaler-reader@scaler-dashboard.iam.gserviceaccount.com`
- Give it **Editor** access (needed for writing notes)

### 3. Add to env vars
In `.env.local` and in Vercel environment variables:
```
NOTES_SHEET_ID=your_sheet_id_here
```

### 4. Restart the server
Notes will now persist across sessions. Any team member who opens the dashboard sees all notes.

### Notes behaviour
- Click ✎ on any metric row to open the note editor
- Notes are saved instantly to your Google Sheet on "Save Note"
- Yellow ● dot on a row means it has a note
- Note preview shows inline below the metric label
- Without NOTES_SHEET_ID set, notes work locally in the session only
