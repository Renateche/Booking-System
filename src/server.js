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
app.use(express.static('public'));

// ---------- Database ----------
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Initialize schema (safe to run on every startup)
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema, (err) => {
  if (err) {
    console.error('Failed to initialize schema:', err.message);
    process.exit(1);
  }
  console.log('Database schema initialized');
});

// ---------- API: GET /equipment ----------
app.get('/equipment', (req, res) => {
  const sql = `
    SELECT
      id,
      name,
      model,
      cimplicity_version,
      switch_port,
      ip_address,
      subnet_mask,
      gateway,
      notes
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

// ---------- API: GET /bookings?equipmentId= ----------
app.get('/bookings', (req, res) => {
  const equipmentId = req.query.equipmentId;

  // Validate query parameter
  if (!equipmentId) {
    return res.status(400).json({
      error: 'Missing required query parameter: equipmentId'
    });
  }

  const sql = `
    SELECT
      id,
      equipment_id,
      start_datetime,
      end_datetime,
      booked_by,
      note,
      created_at
    FROM bookings
    WHERE equipment_id = ?
    ORDER BY start_datetime
  `;

  db.all(sql, [equipmentId], (err, rows) => {
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
app.post('/bookings', (req, res) => {
  const { equipment_id, start_datetime, end_datetime, booked_by, note } = req.body;

  // Basic validation (MVP level)
  if (!equipment_id || !start_datetime || !end_datetime || !booked_by) {
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
      note
    ) VALUES (?, ?, ?, ?, ?)
  `;

  const params = [equipment_id, start_datetime, end_datetime, booked_by, note || null];

  db.run(sql, params, function (err) {
    if (err) {
      // Booking conflict or other DB error
      console.error('Failed to create booking:', err.message);
      return res.status(400).json({
        error: err.message
      });
    }

    // Success — return new booking ID
    res.status(201).json({
      id: this.lastID
    });
  });
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
app.listen(PORT, () => {
  console.log(`Booking system API running on http://localhost:${PORT}`);
});
