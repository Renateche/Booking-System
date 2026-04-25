// generate-seed.js
// Converts CPC_Test.csv -> seed_cpc_equipment.sql
console.log('>>> RUNNING generate-seed.js <<<');

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'CPC_Test.csv');
const outputFile = path.join(__dirname, '..', 'db', 'seed_cpc_equipment.sql');

const raw = fs.readFileSync(inputFile, 'utf8').trim();
const lines = raw.split(/\r?\n/);

const [headerLine, ...rows] = lines;
const headers = headerLine.split(';').map(normalizeHeader);

const headerAliases = {
  name: 'name',
  model: 'model',
  cimplicityversion: 'cimplicity_version',
  switchnoport: 'switch_port',
  ip: 'ip_address',
  subnetmask: 'subnet_mask',
  gateway: 'gateway',
  notes: 'notes',
  os: 'OS',
  type: 'equipment_type',
  location2: 'location_2',
  loacation: 'location',
  location: 'location'
};

let sql = '-- Auto-generated from CPC.csv\n';
sql +=
  'INSERT INTO cpc_equipment (name, model, cimplicity_version, switch_port, ip_address, subnet_mask, gateway, notes, OS, equipment_type, location_2, location) VALUES\n';

const values = rows
  .map((line) => {
    const cols = line.split(';').map((value) => value.trim());
    const record = {};

    headers.forEach((header, index) => {
      const fieldName = headerAliases[header];
      if (fieldName) {
        record[fieldName] = cols[index] || '';
      }
    });

    const name = record.name || '';
    if (!name) return null;

    return `(${toSqlValue(name)}, 
    ${toSqlValue(record.model)}, 
    ${toSqlValue(record.cimplicity_version)}, 
    ${toSqlValue(record.switch_port)}, 
    ${toSqlValue(record.ip_address)}, 
    ${toSqlValue(record.subnet_mask)}, 
    ${toSqlValue(record.gateway)}, 
    ${toSqlValue(record.notes)}, 
    ${toSqlValue(record.OS)}, 
    ${toSqlValue(record.equipment_type)}, 
    ${toSqlValue(record.location_2)}, 
    ${toSqlValue(record.location)})`;
  })
  .filter(Boolean);

sql += values.join(',\n');
sql += `\nON CONFLICT(ip_address) DO UPDATE SET
  model = excluded.model,
  cimplicity_version = excluded.cimplicity_version,
  switch_port = excluded.switch_port,
  ip_address = excluded.ip_address,
  subnet_mask = excluded.subnet_mask,
  gateway = excluded.gateway,
  notes = excluded.notes,
  name = excluded.name,
  OS = excluded.OS,
  equipment_type = excluded.equipment_type,
  location_2 = excluded.location_2,
  location = excluded.location;\n`;

fs.writeFileSync(outputFile, sql, 'utf8');
console.log(`✅ Generated ${outputFile}`);

function normalizeHeader(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escape(value) {
  return value.replace(/'/g, "''");
}

function toSqlValue(value) {
  if (value == null) return 'NULL';

  const trimmed = String(value).trim();
  return trimmed === '' ? 'NULL' : `'${escape(trimmed)}'`;
}
