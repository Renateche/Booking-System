-- Enable WAL mode (better concurrency for SQLite)
PRAGMA journal_mode = WAL;

-- Table: cpc_equipment
CREATE TABLE IF NOT EXISTS cpc_equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,                     -- e.g. HMI-PC1
    equipment_type TEXT,                    -- e.g. HMI
    model TEXT,                             -- e.g. Matrix MXE-5104
    cimplicity_version TEXT,                -- e.g. 8.2
    switch_port TEXT,                       -- e.g. 17/1
    ip_address TEXT,                        -- e.g. 192.168.6.1
    subnet_mask TEXT,                       -- e.g. 255.255.255.0
    gateway TEXT,                           -- e.g. 192.168.6.254
    notes TEXT
    ,OS TEXT
    ,location_2 TEXT
    ,location TEXT
);

-- Prevent duplicate IP addresses
CREATE UNIQUE INDEX IF NOT EXISTS idx_cpc_equipment_ip
ON cpc_equipment(ip_address);

-- Table: bookings
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    equipment_id INTEGER NOT NULL,          -- FK to cpc_equipment
    start_datetime TEXT NOT NULL,           -- ISO 8601: YYYY-MM-DD HH:MM
    end_datetime TEXT NOT NULL,             -- ISO 8601: YYYY-MM-DD HH:MM

    booked_by TEXT NOT NULL,                -- Name / short identifier
    note TEXT,
    project_number TEXT,
    project_name TEXT,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (equipment_id)
        REFERENCES cpc_equipment(id)
        ON DELETE CASCADE
);

-- Prevent overlapping bookings on INSERT
CREATE TRIGGER IF NOT EXISTS trg_prevent_booking_overlap_insert
BEFORE INSERT ON bookings
BEGIN
    SELECT
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM bookings
                WHERE equipment_id = NEW.equipment_id
                  AND NEW.start_datetime < end_datetime
                  AND NEW.end_datetime   > start_datetime
            )
            THEN
                RAISE(ABORT, 'Booking conflict: equipment already booked in this time range')
        END;
END;

-- Prevent overlapping bookings on UPDATE
CREATE TRIGGER IF NOT EXISTS trg_prevent_booking_overlap_update
BEFORE UPDATE ON bookings
BEGIN
    SELECT
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM bookings
                WHERE equipment_id = NEW.equipment_id
                  AND id != OLD.id
                  AND NEW.start_datetime < end_datetime
                  AND NEW.end_datetime   > start_datetime
            )
            THEN
                RAISE(ABORT, 'Booking conflict: equipment already booked in this time range')
        END;
END;

-- Index for faster booking lookups
CREATE INDEX IF NOT EXISTS idx_bookings_equipment_time
ON bookings (equipment_id, start_datetime, end_datetime);