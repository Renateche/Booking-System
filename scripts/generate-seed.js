// generate-seed.js
// Converts CPC.csv → seed_cpc_equipment.sql

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'CPC.csv');
const outputFile = path.join(__dirname, '..', 'db', 'seed_cpc_equipment.sql');

const raw = fs.readFileSync(inputFile, 'utf8').trim();
const lines = raw.split(/\r?\n/);

// Adjust these indices if your CSV column order differs
const HEADER = true;
const NAME_COL = 0; // Name
const MODEL_COL = 1; // Model
const LOCATION_COL = 2; // Location (optional)
const NOTE_COL = 3; // Note (optional)

const rows = HEADER ? lines.slice(1) : lines;

let sql = '-- Auto‑generated from CPC.csv\n';
sql +=
  'INSERT INTO cpc_equipment (name, model, cimplicity_version, switch_port, ip_address, subnet_mask, gateway, notes) VALUES\n';

const values = rows
  .map((line) => {
    const cols = line.split(',');

    const name = (cols[NAME_COL] || '').trim();
    if (!name) return null;

    const model = (cols[MODEL_COL] || '').trim();
    const location = (cols[LOCATION_COL] || '').trim();
    const note = (cols[NOTE_COL] || '').trim();

    return `('${escape(name)}', '${escape(model)}', '${escape(location)}', '${escape(note)}')`;
  })
  .filter(Boolean);

sql += values.join(',\n');
sql += ';\n';

fs.writeFileSync(outputFile, sql, 'utf8');
console.log(`✅ Generated ${outputFile}`);

function escape(value) {
  return value.replace(/'/g, "''");
}
