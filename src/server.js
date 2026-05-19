const fs = require('fs');
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

// ---------- Paths ----------
const dbPath = path.join(__dirname, '..', 'db', 'database.sqlite');
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

// ---------- App ----------
const app = express();
app.use(express.json());
// app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'public', 'index.html'));
});

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve(this);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

function execAsync(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseBookingDate(value) {
  const [datePart] = value.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function isEquipmentAvailable(bookings, candidateStart, durationDays) {
  const candidateEnd = addDays(candidateStart, durationDays);

  return bookings.every((booking) => {
    const bookingStart = parseBookingDate(booking.start_datetime);
    const bookingEnd = parseBookingDate(booking.end_datetime);
    return !(candidateStart < bookingEnd && candidateEnd > bookingStart);
  });
}

function findSuggestedPackage(
  equipmentByType,
  bookingsByEquipmentId,
  durationDays,
  searchStart,
  requestedQuantitiesByType = {}
) {
  const selectedTypes = Array.from(equipmentByType.keys()).sort((left, right) =>
    left.localeCompare(right)
  );

  const mapEquipment = (equipment) => ({
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    equipmentType: equipment.equipment_type,
    equipmentModel: equipment.model,
    ipAddress: equipment.ip_address,
    operatingSystem: equipment.OS || null,
    cimplicityVersion: equipment.cimplicity_version || null
  });

  for (let offset = 0; offset < 365; offset++) {
    const candidateStart = addDays(searchStart, offset);
    const chosenEquipment = [];
    let allTypesMatched = true;

    for (const type of selectedTypes) {
      const requestedQuantity = Math.max(
        1,
        Number.parseInt(requestedQuantitiesByType[type], 10) || 1
      );
      const availableEquipment = (equipmentByType.get(type) || []).filter((equipment) =>
        isEquipmentAvailable(bookingsByEquipmentId.get(equipment.id) || [], candidateStart, durationDays)
      );

      if (availableEquipment.length < requestedQuantity) {
        allTypesMatched = false;
        break;
      }

      chosenEquipment.push(...availableEquipment.slice(0, requestedQuantity));
    }

    if (allTypesMatched) {
      const availableOptionsByType = {};

      for (const type of selectedTypes) {
        const options = (equipmentByType.get(type) || []).map(mapEquipment);

        availableOptionsByType[type] = options;
      }

      return {
        requestedTypes: selectedTypes,
        requestedQuantities: Object.fromEntries(
          selectedTypes.map((type) => [
            type,
            Math.max(1, Number.parseInt(requestedQuantitiesByType[type], 10) || 1)
          ])
        ),
        durationDays,
        startDate: formatDate(candidateStart),
        endDate: formatDate(addDays(candidateStart, durationDays - 1)),
        equipments: chosenEquipment.map(mapEquipment),
        availableOptionsByType
      };
    }
  }

  return null;
}

function getColumn(columns, name) {
  return columns.find((column) => column.name === name);
}

function findEarliestSlot(bookings, durationDays, searchStart) {
  let candidateStart = startOfDay(searchStart);

  for (const booking of bookings) {
    const bookingStart = parseBookingDate(booking.start_datetime);
    const bookingEnd = parseBookingDate(booking.end_datetime);
    const candidateEnd = addDays(candidateStart, durationDays);

    if (candidateEnd <= bookingStart) {
      break;
    }

    const overlaps = candidateStart < bookingEnd && candidateEnd > bookingStart;
    if (overlaps) {
      candidateStart = new Date(bookingEnd);
    }
  }

  return {
    startDate: formatDate(candidateStart),
    endDate: formatDate(addDays(candidateStart, durationDays - 1))
  };
}

async function ensureEquipmentTypeColumn() {
  const columns = await allAsync('PRAGMA table_info(cpc_equipment)');
  const columnNames = new Set(columns.map((column) => column.name));
  const expectedColumns = [
    { name: 'equipment_type', definition: 'TEXT' },
    { name: 'OS', definition: 'TEXT' },
    { name: 'location_2', definition: 'TEXT' },
    { name: 'location', definition: 'TEXT' }
  ];

  for (const column of expectedColumns) {
    if (!columnNames.has(column.name)) {
      await runAsync(
        `ALTER TABLE cpc_equipment ADD COLUMN ${quoteIdentifier(column.name)} ${column.definition}`
      );
      columnNames.add(column.name);
    }
  }

  const legacyTypeColumn = columns.find((column) => column.name.toLowerCase() === 'type');

  if (legacyTypeColumn) {
    await runAsync(`
      UPDATE cpc_equipment
      SET equipment_type = COALESCE(NULLIF(TRIM(${quoteIdentifier(legacyTypeColumn.name)}), ''), equipment_type)
      WHERE equipment_type IS NULL OR TRIM(equipment_type) = ''
    `);
  }

  await runAsync(`
    UPDATE cpc_equipment
    SET equipment_type = CASE
      WHEN name LIKE 'HMI-%' THEN 'HMI'
      WHEN name LIKE 'RMC-%' THEN 'RMC'
      WHEN UPPER(name) LIKE '%SERVER%' THEN 'Server'
      WHEN UPPER(name) LIKE '%PLC%' THEN 'PLC'
      ELSE 'Unclassified'
    END
    WHERE equipment_type IS NULL OR TRIM(equipment_type) = ''
  `);

  const refreshedColumns = await allAsync('PRAGMA table_info(cpc_equipment)');
  const requiresRebuild = ['model', 'ip_address', 'subnet_mask', 'gateway'].some((name) => {
    const column = getColumn(refreshedColumns, name);
    return column && column.notnull === 1;
  });

  if (requiresRebuild) {
    await rebuildEquipmentTable();
  }
}

async function rebuildEquipmentTable() {
  await execAsync(`
    PRAGMA foreign_keys = OFF;
    BEGIN TRANSACTION;

    ALTER TABLE cpc_equipment RENAME TO cpc_equipment_legacy;

    CREATE TABLE cpc_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      equipment_type TEXT,
      model TEXT,
      cimplicity_version TEXT,
      switch_port TEXT,
      ip_address TEXT,
      subnet_mask TEXT,
      gateway TEXT,
      notes TEXT,
      OS TEXT,
      location_2 TEXT,
      location TEXT
    );

    INSERT INTO cpc_equipment (
      id,
      name,
      equipment_type,
      model,
      cimplicity_version,
      switch_port,
      ip_address,
      subnet_mask,
      gateway,
      notes,
      OS,
      location_2,
      location
    )
    SELECT
      id,
      name,
      equipment_type,
      model,
      cimplicity_version,
      switch_port,
      ip_address,
      subnet_mask,
      gateway,
      notes,
      OS,
      location_2,
      location
    FROM cpc_equipment_legacy;

    DROP TABLE cpc_equipment_legacy;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_cpc_equipment_ip
    ON cpc_equipment(ip_address);

    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

async function initializeDatabase() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await execAsync(schema);
  console.log('Database schema initialized');

  await ensureEquipmentTypeColumn();
  await runAsync('DROP INDEX IF EXISTS idx_cpc_equipment_name');
  console.log('Equipment type column ready');
}

// ---------- Database ----------
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// ---------- API: GET /equipment ----------
app.get('/equipment', (req, res) => {
  const sql = `
    SELECT
      id,
      name,
      equipment_type,
      model,
      cimplicity_version,
      switch_port,
      ip_address,
      subnet_mask,
      gateway,
      notes,
      OS,
      location_2,
      location
    FROM cpc_equipment
    ORDER BY name
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Failed to fetch equipment:', err.message);
      return res.status(500).json({
        error: 'Failed to fetch equipment'
      });
    }

    res.json(rows);
  });
});

// ---------- API: GET /equipment-types ----------
app.get('/equipment-types', (req, res) => {
  const sql = `
    SELECT
      equipment_type AS type,
      GROUP_CONCAT(DISTINCT CASE WHEN OS IS NOT NULL AND TRIM(OS) != '' THEN OS END) AS osValues,
      GROUP_CONCAT(DISTINCT CASE WHEN cimplicity_version IS NOT NULL AND TRIM(cimplicity_version) != '' THEN cimplicity_version END) AS versionValues
    FROM cpc_equipment
    WHERE equipment_type IS NOT NULL
      AND TRIM(equipment_type) != ''
    GROUP BY equipment_type
    ORDER BY equipment_type
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Failed to fetch equipment types:', err.message);
      return res.status(500).json({
        error: 'Failed to fetch equipment types'
      });
    }

    const result = rows.map((row) => ({
      type: row.type,
      osOptions: row.osValues
        ? row.osValues
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      versionOptions: row.versionValues
        ? row.versionValues
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    }));

    res.json(result);
  });
});

// ---------- API: GET /availability-suggestion ----------
app.get('/availability-suggestion', async (req, res) => {
  const rawTypes = Array.isArray(req.query.types) ? req.query.types.join(',') : req.query.types;
  const selectedTypes = String(rawTypes || '')
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
  const requestedStartDate = String(req.query.startDate || '').trim();
  const requestedEndDate = String(req.query.endDate || '').trim();
  const requestedDurationDays = Number.parseInt(req.query.durationDays, 10);

  let durationDays = null;
  let searchStart = startOfDay(new Date());

  let requirementsByType = {};
  try {
    if (req.query.requirements) {
      requirementsByType = JSON.parse(req.query.requirements);
    }
  } catch (_) {
    // ignore invalid JSON
  }

  if (selectedTypes.length === 0) {
    return res.status(400).json({
      error: 'Missing required query parameter: types'
    });
  }

  if (requestedStartDate || requestedEndDate) {
    if (!requestedStartDate || !requestedEndDate) {
      return res.status(400).json({
        error: 'Both startDate and endDate are required when using a preferred date range'
      });
    }

    const parsedStartDate = parseDateOnly(requestedStartDate);
    const parsedEndDate = parseDateOnly(requestedEndDate);

    if (!parsedStartDate || !parsedEndDate) {
      return res.status(400).json({
        error: 'startDate and endDate must be valid dates in YYYY-MM-DD format'
      });
    }

    if (parsedEndDate < parsedStartDate) {
      return res.status(400).json({
        error: 'endDate must be on or after startDate'
      });
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    durationDays = Math.floor((parsedEndDate - parsedStartDate) / msPerDay) + 1;
    searchStart = startOfDay(parsedStartDate);
  } else if (Number.isInteger(requestedDurationDays) && requestedDurationDays > 0) {
    durationDays = requestedDurationDays;
  } else {
    return res.status(400).json({
      error: 'Provide either durationDays (> 0) or both startDate and endDate'
    });
  }

  try {
    const typePlaceholders = selectedTypes.map(() => '?').join(', ');
    const allMatchingEquipment = await allAsync(
      `
        SELECT id, name, equipment_type, model, ip_address, OS, cimplicity_version
        FROM cpc_equipment
        WHERE equipment_type IN (${typePlaceholders})
        ORDER BY name
      `,
      selectedTypes
    );

    if (allMatchingEquipment.length === 0) {
      return res.status(404).json({
        error: 'No equipment found for the selected types'
      });
    }

    const matchingEquipment = allMatchingEquipment.filter((equipment) => {
      const typeReqs = requirementsByType[equipment.equipment_type];
      if (!typeReqs) return true;
      if (typeReqs.os && equipment.OS !== typeReqs.os) return false;
      if (typeReqs.version && equipment.cimplicity_version !== typeReqs.version) return false;
      return true;
    });

    if (matchingEquipment.length === 0) {
      return res.status(404).json({
        error: 'No equipment found matching the selected OS/version requirements'
      });
    }

    const equipmentByType = new Map();

    matchingEquipment.forEach((equipment) => {
      const existing = equipmentByType.get(equipment.equipment_type) || [];
      existing.push(equipment);
      equipmentByType.set(equipment.equipment_type, existing);
    });

    const missingTypes = selectedTypes.filter((type) => !equipmentByType.has(type));

    if (missingTypes.length > 0) {
      return res.status(404).json({
        error: `No equipment found for type(s): ${missingTypes.join(', ')}`
      });
    }

    const requestedQuantitiesByType = Object.fromEntries(
      selectedTypes.map((type) => {
        const quantity = Number.parseInt(requirementsByType[type]?.quantity, 10);
        return [type, Number.isInteger(quantity) && quantity > 0 ? quantity : 1];
      })
    );

    const underProvisionedTypes = selectedTypes.filter(
      (type) => (equipmentByType.get(type) || []).length < requestedQuantitiesByType[type]
    );

    if (underProvisionedTypes.length > 0) {
      return res.status(404).json({
        error: `Not enough equipment available for type(s): ${underProvisionedTypes.join(', ')}`
      });
    }

    const equipmentIds = matchingEquipment.map((equipment) => equipment.id);
    const bookingPlaceholders = equipmentIds.map(() => '?').join(', ');
    const bookings = await allAsync(
      `
        SELECT equipment_id, start_datetime, end_datetime
        FROM bookings
        WHERE equipment_id IN (${bookingPlaceholders})
        ORDER BY equipment_id, start_datetime
      `,
      equipmentIds
    );

    const bookingsByEquipmentId = new Map();

    bookings.forEach((booking) => {
      const existing = bookingsByEquipmentId.get(booking.equipment_id) || [];
      existing.push(booking);
      bookingsByEquipmentId.set(booking.equipment_id, existing);
    });

    const suggestion = findSuggestedPackage(
      equipmentByType,
      bookingsByEquipmentId,
      durationDays,
      searchStart,
      requestedQuantitiesByType
    );

    if (!suggestion) {
      return res.status(404).json({
        error: 'No shared availability found for the selected types'
      });
    }

    res.json(suggestion);
  } catch (err) {
    console.error('Failed to compute availability suggestion:', err.message);
    res.status(500).json({
      error: 'Failed to compute availability suggestion'
    });
  }
});

// ---------- API: GET /bookings?equipmentId= ----------
app.get('/bookings', (req, res) => {
  const rawEquipmentIds = Array.isArray(req.query.equipmentIds)
    ? req.query.equipmentIds.join(',')
    : req.query.equipmentIds;
  const equipmentIds = String(rawEquipmentIds || req.query.equipmentId || '')
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value));

  let sql;
  let params;

  if (equipmentIds.length === 0) {
    // If no equipment IDs provided, return all bookings
    sql = `
      SELECT
        bookings.id,
        bookings.equipment_id,
        bookings.start_datetime,
        bookings.end_datetime,
        bookings.booked_by,
        bookings.note,
        bookings.created_at,
        bookings.project_number,
        bookings.project_name,
        cpc_equipment.name AS equipment_name,
        cpc_equipment.equipment_type AS equipment_type
      FROM bookings
      JOIN cpc_equipment ON cpc_equipment.id = bookings.equipment_id
      ORDER BY bookings.start_datetime, cpc_equipment.name
    `;
    params = [];
  } else {
    // If equipment IDs provided, filter by them
    const placeholders = equipmentIds.map(() => '?').join(', ');
    sql = `
      SELECT
        bookings.id,
        bookings.equipment_id,
        bookings.start_datetime,
        bookings.end_datetime,
        bookings.booked_by,
        bookings.note,
        bookings.created_at,
        bookings.project_number,
        bookings.project_name,
        cpc_equipment.name AS equipment_name,
        cpc_equipment.equipment_type AS equipment_type
      FROM bookings
      JOIN cpc_equipment ON cpc_equipment.id = bookings.equipment_id
      WHERE bookings.equipment_id IN (${placeholders})
      ORDER BY bookings.start_datetime, cpc_equipment.name
    `;
    params = equipmentIds;
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Failed to fetch bookings:', err.message);
      return res.status(500).json({
        error: 'Failed to fetch bookings'
      });
    }

    res.json(rows);
  });
});

// ---------- API: POST /bookings ----------
app.post('/bookings', async (req, res) => {
  const { equipment_id, equipment_ids, start_datetime, end_datetime, booked_by, note, project_number, project_name } = req.body;
  const normalizedEquipmentIds = Array.isArray(equipment_ids)
    ? equipment_ids
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value))
    : Number.isInteger(Number.parseInt(equipment_id, 10))
      ? [Number.parseInt(equipment_id, 10)]
      : [];

  // Basic validation (MVP level)
  if (normalizedEquipmentIds.length === 0 || !start_datetime || !end_datetime || !booked_by) {
    return res.status(400).json({
      error: 'Missing required fields'
    });
  }

  const sql = `
    INSERT INTO bookings (
      equipment_id,
      start_datetime,
      end_datetime,
      booked_by,
      note,
      project_number,
      project_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    await runAsync('BEGIN TRANSACTION');

    const bookingIds = [];

    for (const equipmentIdValue of normalizedEquipmentIds) {
      const params = [equipmentIdValue, start_datetime, end_datetime, booked_by, note || null, project_number || null, project_name || null];
      const result = await runAsync(sql, params);
      bookingIds.push(result.lastID);
    }

    await runAsync('COMMIT');

    res.status(201).json({
      ids: bookingIds
    });
  } catch (err) {
    await runAsync('ROLLBACK').catch(() => {});
    console.error('Failed to create booking:', err.message);
    res.status(400).json({
      error: err.message
    });
  }
});

// ---------- API: DELETE /bookings/:id ----------
app.delete('/bookings/:id', (req, res) => {
  const bookingId = req.params.id;

  const sql = `
    DELETE FROM bookings
    WHERE id = ?
  `;

  db.run(sql, [bookingId], function (err) {
    if (err) {
      console.error('Failed to delete booking:', err.message);
      return res.status(500).json({
        error: 'Failed to delete booking'
      });
    }

    // this.changes tells us how many rows were affected
    if (this.changes === 0) {
      return res.status(404).json({
        error: 'Booking not found'
      });
    }

    res.json({
      message: 'Booking deleted'
    });
  });
});
``;

// ---------- Server ----------
const PORT = 3000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Booking system API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
