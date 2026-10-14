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
4. Click **Generate Combined Balance**.
5. Review the merged daily table and download the CSV if needed.

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

## Deploy to GitHub Pages

This project is ready to host as a static website on GitHub Pages.

1. Push this folder to a GitHub repository.
2. In the repository, open **Settings** > **Pages**.
3. Set the source to **Deploy from a branch**.
4. Select the branch you want to publish, usually `main`.
5. Keep the folder as `/` for the root of the repository, or use `/docs` if you prefer to place the app in a docs folder.
6. Save the settings.

After a few minutes, GitHub will provide a public URL such as:

```text
https://your-username.github.io/your-repository-name/
```

## GitHub-ready notes

- No backend is required.
- Uploaded CSVs stay in the browser; nothing is sent to a server.
- This is a suitable static hosting model for sharing with friends or team members.
- The app accepts multiple account files and merges them into one combined daily balance sheet.
