# Combined Account Balance Sheet Generator

This project is a simple static web app that lets you upload multiple CSV files and generate a merged daily balance sheet across all accounts.

## Expected CSV format

Each uploaded CSV must contain these columns only:

```csv
date,debit,credit,balance
14/01/2025,15000.00,,4018.71
14/01/2025,,10000.00,14018.71
15/01/2025,,100000.00,114018.71
```

- `date`: transaction date
- `debit`: debit amount (negative movement)
- `credit`: credit amount (positive movement)
- `balance`: running balance for the account

## How to use

1. Open `index.html` in a browser.
2. Click **Choose CSV files**.
3. Select multiple account CSV files.
4. Check the selected-file count in the upload panel, then click **Generate Combined Balance**.
5. Watch the status indicator while files are read and balances are calculated; it confirms when generation is complete or shows an error if processing fails.
6. Review the merged daily table and download the CSV if needed.

## Notes

- The app treats each uploaded CSV file as one account.
- It infers the opening balance for each account using the first observation date.
- It carries the running balances forward across the year.
- It combines all account balances into a single daily total.

## Example

The project includes an example CSV pair in the `samples` folder.

## Run locally

Because this is a static site, you can also start a simple local server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```
