const REQUIRED_COLUMNS = ['date', 'debit', 'credit', 'balance'];
let mergedData = [];
let mergedCsvText = '';

const fileInput = document.getElementById('fileInput');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const fileCountEl = document.getElementById('fileCount');
const generationStatus = document.getElementById('generationStatus');
const generationStatusText = document.getElementById('generationStatusText');
const summaryEl = document.getElementById('summary');
const resultTable = document.getElementById('resultTable');

function setGenerationStatus(message, state) {
  generationStatusText.textContent = message;
  generationStatus.dataset.state = state;
}

function updateFileCount() {
  const count = fileInput.files?.length || 0;
  fileCountEl.textContent = count === 0
    ? 'No files selected yet.'
    : `${count} ${count === 1 ? 'file' : 'files'} selected.`;
  setGenerationStatus(
    count === 0 ? 'Choose CSV files to get started.' : 'Ready to generate the combined balance.',
    'idle'
  );
}

function normalizeDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const candidates = [
    { format: ['DD/MM/YYYY', 'D/M/YYYY'], regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/ },
    { format: ['YYYY-MM-DD'], regex: /^\d{4}-\d{2}-\d{2}$/ },
    { format: ['MM/DD/YYYY'], regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/ },
  ];

  for (const candidate of candidates) {
    if (candidate.regex.test(trimmed)) {
      if (candidate.format[0] === 'YYYY-MM-DD') {
        return new Date(trimmed + 'T00:00:00');
      }

      const [day, month, year] = trimmed.split('/').map(Number);
      return new Date(year, month - 1, day);
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/[$,\s]/g, '').replace(/['"]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseCSVLine(line) {
  let values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV file must include a header row and at least one data row.');
  }

  const headers = parseCSVLine(lines[0]).map((header) => header.toLowerCase().trim());

  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    throw new Error(`CSV is missing required columns: ${missing.join(', ')}`);
  }

  const indexMap = Object.fromEntries(headers.map((header, index) => [header, index]));
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCSVLine(lines[i]);
    const record = {};

    REQUIRED_COLUMNS.forEach((column) => {
      const value = values[indexMap[column]] ?? '';
      record[column] = value;
    });

    const date = normalizeDate(record.date);
    if (!date) {
      continue;
    }

    rows.push({
      date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      debit: parseNumber(record.debit),
      credit: parseNumber(record.credit),
      balance: parseNumber(record.balance),
    });
  }

  if (rows.length === 0) {
    throw new Error('No valid rows were found in this CSV file.');
  }

  return rows.sort((a, b) => a.date - b.date);
}

function inferOpeningBalance(rows) {
  const sorted = [...rows].sort((a, b) => a.date - b.date);
  const firstDate = sorted[0].date;
  const firstDateRows = sorted.filter((row) => formatDateISO(row.date) === formatDateISO(firstDate));

  const lastBalanceOnFirstDate = firstDateRows[firstDateRows.length - 1].balance;
  const netOnFirstDate = firstDateRows.reduce((sum, row) => sum + row.credit - row.debit, 0);
  return lastBalanceOnFirstDate - netOnFirstDate;
}

function makeDailyCarryForward(rows) {
  const sorted = [...rows].sort((a, b) => a.date - b.date);
  const opening = inferOpeningBalance(sorted);
  const perDate = {};

  for (const row of sorted) {
    const key = formatDateISO(row.date);
    perDate[key] = row.balance;
  }

  const startDate = new Date(sorted[0].date.getFullYear(), 0, 1);
  const endDate = new Date(sorted[sorted.length - 1].date.getFullYear(), 11, 31);
  const daily = {};

  let current = opening;
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const iso = formatDateISO(cursor);
    if (perDate[iso] !== undefined) {
      current = perDate[iso];
    }
    daily[iso] = current;
    cursor.setDate(cursor.getDate() + 1);
  }

  return daily;
}

function buildMergedTable(files) {
  const accountSeries = [];

  for (const file of files) {
    const parsed = parseCSV(file.text);
    accountSeries.push({
      name: file.name,
      daily: makeDailyCarryForward(parsed),
    });
  }

  const dateKeys = new Set();
  accountSeries.forEach((account) => {
    Object.keys(account.daily).forEach((key) => dateKeys.add(key));
  });

  const allDates = Array.from(dateKeys).sort();
  if (!allDates.length) {
    throw new Error('No valid dates were found in the uploaded files.');
  }

  const start = new Date(`${allDates[0]}T00:00:00`);
  const end = new Date(`${allDates[allDates.length - 1]}T00:00:00`);

  const merged = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const iso = formatDateISO(cursor);
    const row = { date: iso };
    let combined = 0;

    accountSeries.forEach((account) => {
      const value = account.daily[iso] ?? 0;
      row[account.name] = value;
      combined += value;
    });

    row.combined = combined;
    merged.push(row);
    cursor.setDate(cursor.getDate() + 1);
  }

  return { accountSeries, merged };
}

function createSummary(files, merged) {
  const fileCount = files.length;
  const finalCombined = merged.length ? merged[merged.length - 1].combined : 0;
  const opening = merged.length ? merged[0].combined : 0;

  summaryEl.innerHTML = `
    <div class="summary-pill">
      <strong>Files uploaded</strong>
      <span>${fileCount}</span>
    </div>
    <div class="summary-pill">
      <strong>Opening balance</strong>
      <span>${formatMoney(opening)}</span>
    </div>
    <div class="summary-pill">
      <strong>Closing balance</strong>
      <span>${formatMoney(finalCombined)}</span>
    </div>
    <div class="summary-pill">
      <strong>Time range</strong>
      <span>${merged[0]?.date || 'N/A'} to ${merged[merged.length - 1]?.date || 'N/A'}</span>
    </div>
  `;
}

function formatMoney(value) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function renderTable(data, accounts) {
  const thead = resultTable.querySelector('thead');
  const tbody = resultTable.querySelector('tbody');

  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headerRow = document.createElement('tr');
  const dateHeader = document.createElement('th');
  dateHeader.textContent = 'Date';
  headerRow.appendChild(dateHeader);

  accounts.forEach((account) => {
    const th = document.createElement('th');
    th.textContent = account.name.replace(/\.[^/.]+$/, '');
    headerRow.appendChild(th);
  });

  const combinedHeader = document.createElement('th');
  combinedHeader.textContent = 'Combined Balance';
  headerRow.appendChild(combinedHeader);
  thead.appendChild(headerRow);

  data.forEach((row) => {
    const tr = document.createElement('tr');

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDateDisplay(new Date(`${row.date}T00:00:00`));
    tr.appendChild(dateCell);

    accounts.forEach((account) => {
      const cell = document.createElement('td');
      cell.textContent = formatMoney(row[account.name]);
      tr.appendChild(cell);
    });

    const totalCell = document.createElement('td');
    totalCell.textContent = formatMoney(row.combined);
    tr.appendChild(totalCell);

    tbody.appendChild(tr);
  });
}

function buildCsv(data, accounts) {
  const header = ['Date', ...accounts.map((account) => account.name.replace(/\.[^/.]+$/, '')), 'Combined Balance'];
  const lines = [header.join(',')];

  data.forEach((row) => {
    const values = [row.date];
    accounts.forEach((account) => values.push(row[account.name]));
    values.push(row.combined);
    lines.push(values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
  });

  return lines.join('\n');
}

async function handleFiles() {
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    setGenerationStatus('Select at least one CSV file to continue.', 'error');
    alert('Please upload at least one CSV file.');
    return;
  }

  const csvFiles = files.filter((file) => file.name.toLowerCase().endsWith('.csv'));
  if (!csvFiles.length) {
    setGenerationStatus('No CSV files were selected. Choose one or more CSV files.', 'error');
    alert('Only CSV files are supported.');
    return;
  }

  generateBtn.disabled = true;
  fileInput.disabled = true;
  try {
    setGenerationStatus(`Reading ${csvFiles.length} ${csvFiles.length === 1 ? 'file' : 'files'}...`, 'processing');
    const loaded = await Promise.all(
      csvFiles.map(async (file) => ({
        name: file.name,
        text: await file.text(),
      }))
    );

    setGenerationStatus('Calculation in progress...', 'processing');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const result = buildMergedTable(loaded);
    mergedData = result.merged;
    mergedCsvText = buildCsv(mergedData, loaded.map((file) => ({ name: file.name })));

    createSummary(csvFiles, mergedData);
    renderTable(mergedData, loaded.map((file) => ({ name: file.name })));
    setGenerationStatus(
      `Calculation complete. Combined balances for ${mergedData.length} ${mergedData.length === 1 ? 'day' : 'days'}.`,
      'success'
    );
  } catch (error) {
    const message = error.message || 'An error occurred while processing the CSV files.';
    setGenerationStatus(`Calculation failed: ${message}`, 'error');
    alert(error.message || 'An error occurred while processing the CSV files.');
  } finally {
    generateBtn.disabled = false;
    fileInput.disabled = false;
  }
}

function downloadCsv() {
  if (!mergedData.length) {
    alert('Generate the merged balance before downloading.');
    return;
  }

  const blob = new Blob([mergedCsvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'combined_balance_sheet.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

generateBtn.addEventListener('click', handleFiles);
downloadBtn.addEventListener('click', downloadCsv);
fileInput.addEventListener('change', updateFileCount);

const initialMessage = document.createElement('div');
initialMessage.className = 'empty-state';
initialMessage.textContent = 'Upload CSV files to generate the combined balance sheet.';
resultTable.querySelector('tbody').appendChild(initialMessage);
