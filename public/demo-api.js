(function () {
  const STORAGE_KEY = 'booking-system-demo-bookings-v1';

  const demoEquipment = [
    {
      id: 1,
      name: 'HMI-PC1',
      equipment_type: 'HMI',
      model: 'Industrial PC',
      ip_address: '192.168.6.1',
      OS: 'Windows 10',
      cimplicity_version: 'Cimplicity 8.2'
    },
    {
      id: 2,
      name: 'HMI-PC2',
      equipment_type: 'HMI',
      model: 'Industrial PC',
      ip_address: '192.168.6.2',
      OS: 'Windows 10',
      cimplicity_version: 'Cimplicity 2023'
    },
    {
      id: 3,
      name: 'RMC-PC1',
      equipment_type: 'RMC',
      model: 'Industrial PC',
      ip_address: '192.168.6.200',
      OS: 'Windows 10',
      cimplicity_version: null
    },
    {
      id: 4,
      name: 'RMC-PC2',
      equipment_type: 'RMC',
      model: 'Industrial PC',
      ip_address: '192.168.6.201',
      OS: 'Windows 11',
      cimplicity_version: null
    },
    {
      id: 5,
      name: 'DRILLVIEW SERVER 1',
      equipment_type: 'Server',
      model: 'Virtual Machine',
      ip_address: '192.168.6.20',
      OS: null,
      cimplicity_version: null
    },
    {
      id: 6,
      name: 'DRILLVIEW SERVER 2',
      equipment_type: 'Server',
      model: 'Virtual Machine',
      ip_address: '192.168.6.21',
      OS: null,
      cimplicity_version: null
    },
    {
      id: 7,
      name: '300-PLC01',
      equipment_type: '300PLC',
      model: 'PLC Rack',
      ip_address: '192.168.6.40',
      OS: null,
      cimplicity_version: null
    },
    {
      id: 8,
      name: '300-PLC02',
      equipment_type: '300PLC',
      model: 'PLC Rack',
      ip_address: '192.168.6.41',
      OS: null,
      cimplicity_version: null
    },
    {
      id: 9,
      name: '400-PLC01',
      equipment_type: '400PLC',
      model: 'PLC Rack',
      ip_address: '192.168.6.42',
      OS: null,
      cimplicity_version: null
    },
    {
      id: 10,
      name: '400-PLC02',
      equipment_type: '400PLC',
      model: 'PLC Rack',
      ip_address: '192.168.6.43',
      OS: null,
      cimplicity_version: null
    }
  ];

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
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

  function toDateTimeString(date) {
    return `${formatDate(date)} 00:00`;
  }

  function seedBookings() {
    const today = startOfDay(new Date());

    return [
      {
        id: 1,
        equipment_id: 1,
        start_datetime: toDateTimeString(addDays(today, 1)),
        end_datetime: toDateTimeString(addDays(today, 4)),
        booked_by: 'Demo User',
        note: 'HMI training block',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        equipment_id: 3,
        start_datetime: toDateTimeString(addDays(today, 3)),
        end_datetime: toDateTimeString(addDays(today, 6)),
        booked_by: 'Controls Team',
        note: 'Recipe testing',
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        equipment_id: 5,
        start_datetime: toDateTimeString(addDays(today, 2)),
        end_datetime: toDateTimeString(addDays(today, 5)),
        booked_by: 'QA Demo',
        note: 'Server validation',
        created_at: new Date().toISOString()
      },
      {
        id: 4,
        equipment_id: 7,
        start_datetime: toDateTimeString(addDays(today, 1)),
        end_datetime: toDateTimeString(addDays(today, 3)),
        booked_by: 'Automation',
        note: 'PLC smoke test',
        created_at: new Date().toISOString()
      }
    ];
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadBookings() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const seeded = seedBookings();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn('Invalid demo bookings found in localStorage. Resetting sample data.');
    }

    const seeded = seedBookings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function saveBookings(bookings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  }

  function getBookingSignature(booking) {
    return [
      booking.equipment_id,
      booking.start_datetime,
      booking.end_datetime,
      booking.booked_by,
      booking.note || ''
    ].join('|');
  }

  function addSeedBookings() {
    const currentBookings = loadBookings();
    const existingSignatures = new Set(currentBookings.map(getBookingSignature));
    const nextBookings = [...currentBookings];
    let nextId = currentBookings.reduce((maxId, booking) => Math.max(maxId, booking.id), 0) + 1;

    seedBookings().forEach((booking) => {
      if (existingSignatures.has(getBookingSignature(booking))) {
        return;
      }

      nextBookings.push({
        ...booking,
        id: nextId++
      });
    });

    saveBookings(nextBookings);
  }

  function createJsonResponse(body, status) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(clone(body))
    });
  }

  function getEquipmentMap() {
    return new Map(demoEquipment.map((equipment) => [equipment.id, equipment]));
  }

  function isEquipmentAvailable(bookings, candidateStart, durationDays) {
    const candidateEnd = addDays(candidateStart, durationDays);

    return bookings.every((booking) => {
      const bookingStart = parseBookingDate(booking.start_datetime);
      const bookingEnd = parseBookingDate(booking.end_datetime);
      return !(candidateStart < bookingEnd && candidateEnd > bookingStart);
    });
  }

  function findSuggestedPackage(selectedTypes, durationDays, requirementsByType, searchStartDate) {
    requirementsByType = requirementsByType || {};
    const searchStart = startOfDay(searchStartDate || new Date());
    const sortedTypes = [...selectedTypes].sort((left, right) => left.localeCompare(right));
    const mapEquipment = (equipment) => ({
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      equipmentType: equipment.equipment_type,
      equipmentModel: equipment.model,
      ipAddress: equipment.ip_address,
      operatingSystem: equipment.OS || null,
      cimplicityVersion: equipment.cimplicity_version || null
    });
    const equipmentByType = new Map();
    const bookings = loadBookings();
    const bookingsByEquipmentId = new Map();

    demoEquipment.forEach((equipment) => {
      if (!sortedTypes.includes(equipment.equipment_type)) {
        return;
      }

      const typeReqs = requirementsByType[equipment.equipment_type];
      if (typeReqs) {
        if (typeReqs.os && equipment.OS !== typeReqs.os) return;
        if (typeReqs.version && equipment.cimplicity_version !== typeReqs.version) return;
      }

      const existing = equipmentByType.get(equipment.equipment_type) || [];
      existing.push(equipment);
      equipmentByType.set(equipment.equipment_type, existing);
    });

    bookings.forEach((booking) => {
      const existing = bookingsByEquipmentId.get(booking.equipment_id) || [];
      existing.push(booking);
      bookingsByEquipmentId.set(booking.equipment_id, existing);
    });

    const missingTypes = sortedTypes.filter((type) => !equipmentByType.has(type));
    if (missingTypes.length > 0) {
      const error = new Error(`No equipment found for type(s): ${missingTypes.join(', ')}`);
      error.status = 404;
      throw error;
    }

    const underProvisionedTypes = sortedTypes.filter(
      (type) =>
        (equipmentByType.get(type) || []).length <
        Math.max(1, Number.parseInt(requirementsByType[type]?.quantity, 10) || 1)
    );
    if (underProvisionedTypes.length > 0) {
      const error = new Error(
        `Not enough equipment available for type(s): ${underProvisionedTypes.join(', ')}`
      );
      error.status = 404;
      throw error;
    }

    for (let offset = 0; offset < 365; offset++) {
      const candidateStart = addDays(searchStart, offset);
      const chosenEquipment = [];
      let allTypesMatched = true;

      for (const type of sortedTypes) {
        const requestedQuantity = Math.max(
          1,
          Number.parseInt(requirementsByType[type]?.quantity, 10) || 1
        );
        const availableEquipment = (equipmentByType.get(type) || []).filter((equipment) =>
          isEquipmentAvailable(
            bookingsByEquipmentId.get(equipment.id) || [],
            candidateStart,
            durationDays
          )
        );

        if (availableEquipment.length < requestedQuantity) {
          allTypesMatched = false;
          break;
        }

        chosenEquipment.push(...availableEquipment.slice(0, requestedQuantity));
      }

      if (allTypesMatched) {
        const availableOptionsByType = {};

        for (const type of sortedTypes) {
          const options = (equipmentByType.get(type) || []).map(mapEquipment);

          availableOptionsByType[type] = options;
        }

        return {
          requestedTypes: sortedTypes,
          requestedQuantities: Object.fromEntries(
            sortedTypes.map((type) => [
              type,
              Math.max(1, Number.parseInt(requirementsByType[type]?.quantity, 10) || 1)
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

    const error = new Error('No shared availability found for the selected types');
    error.status = 404;
    throw error;
  }

  function getBookingRows(equipmentIds) {
    const equipmentIdSet = new Set(equipmentIds);
    const equipmentMap = getEquipmentMap();

    return loadBookings()
      .filter((booking) => equipmentIdSet.has(booking.equipment_id))
      .sort((left, right) => {
        if (left.start_datetime !== right.start_datetime) {
          return left.start_datetime.localeCompare(right.start_datetime);
        }

        const leftName = equipmentMap.get(left.equipment_id)?.name || '';
        const rightName = equipmentMap.get(right.equipment_id)?.name || '';
        return leftName.localeCompare(rightName);
      })
      .map((booking) => {
        const equipment = equipmentMap.get(booking.equipment_id);
        return {
          ...booking,
          equipment_name: equipment?.name || '',
          equipment_type: equipment?.equipment_type || ''
        };
      });
  }

  function hasOverlap(existingBookings, candidateStart, candidateEnd) {
    return existingBookings.some((booking) => {
      const bookingStart = parseBookingDate(booking.start_datetime);
      const bookingEnd = parseBookingDate(booking.end_datetime);
      return candidateStart < bookingEnd && candidateEnd > bookingStart;
    });
  }

  function createBookings(payload) {
    const { equipment_id, equipment_ids, start_datetime, end_datetime, booked_by, note } = payload;
    const normalizedEquipmentIds = Array.isArray(equipment_ids)
      ? equipment_ids.map((value) => Number.parseInt(value, 10)).filter(Number.isInteger)
      : Number.isInteger(Number.parseInt(equipment_id, 10))
        ? [Number.parseInt(equipment_id, 10)]
        : [];

    if (
      normalizedEquipmentIds.length === 0 ||
      !start_datetime ||
      !end_datetime ||
      !String(booked_by || '').trim()
    ) {
      const error = new Error('Missing required fields');
      error.status = 400;
      throw error;
    }

    const candidateStart = parseBookingDate(start_datetime);
    const candidateEnd = parseBookingDate(end_datetime);
    const bookings = loadBookings();
    const equipmentMap = getEquipmentMap();

    normalizedEquipmentIds.forEach((equipmentIdValue) => {
      const equipment = equipmentMap.get(equipmentIdValue);
      if (!equipment) {
        const error = new Error(`Equipment not found: ${equipmentIdValue}`);
        error.status = 404;
        throw error;
      }

      const equipmentBookings = bookings.filter(
        (booking) => booking.equipment_id === equipmentIdValue
      );
      if (hasOverlap(equipmentBookings, candidateStart, candidateEnd)) {
        const error = new Error(`Booking overlaps an existing booking for ${equipment.name}`);
        error.status = 400;
        throw error;
      }
    });

    const nextId = bookings.reduce((maxId, booking) => Math.max(maxId, booking.id), 0) + 1;
    const createdIds = [];

    normalizedEquipmentIds.forEach((equipmentIdValue, index) => {
      const bookingId = nextId + index;
      createdIds.push(bookingId);
      bookings.push({
        id: bookingId,
        equipment_id: equipmentIdValue,
        start_datetime,
        end_datetime,
        booked_by: String(booked_by).trim(),
        note: note || null,
        created_at: new Date().toISOString()
      });
    });

    saveBookings(bookings);

    return {
      ids: createdIds
    };
  }

  function deleteBooking(bookingId) {
    const bookings = loadBookings();
    const nextBookings = bookings.filter((booking) => booking.id !== bookingId);

    if (nextBookings.length === bookings.length) {
      const error = new Error('Booking not found');
      error.status = 404;
      throw error;
    }

    saveBookings(nextBookings);

    return {
      message: 'Booking deleted'
    };
  }

  function handleRequest(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const url = new URL(path, 'https://demo.booking.local');

    if (url.pathname === '/equipment' && method === 'GET') {
      return {
        status: 200,
        body: clone([...demoEquipment].sort((left, right) => left.name.localeCompare(right.name)))
      };
    }

    if (url.pathname === '/equipment-types' && method === 'GET') {
      const types = [...new Set(demoEquipment.map((e) => e.equipment_type))].sort((l, r) =>
        l.localeCompare(r)
      );
      return {
        status: 200,
        body: types.map((type) => {
          const items = demoEquipment.filter((e) => e.equipment_type === type);
          const osOptions = [...new Set(items.map((e) => e.OS).filter(Boolean))].sort();
          const versionOptions = [
            ...new Set(items.map((e) => e.cimplicity_version).filter(Boolean))
          ].sort();
          return { type, osOptions, versionOptions };
        })
      };
    }

    if (url.pathname === '/availability-suggestion' && method === 'GET') {
      const selectedTypes = String(url.searchParams.get('types') || '')
        .split(',')
        .map((type) => type.trim())
        .filter(Boolean);
      const requestedStartDate = String(url.searchParams.get('startDate') || '').trim();
      const requestedEndDate = String(url.searchParams.get('endDate') || '').trim();
      const requestedDurationDays = Number.parseInt(url.searchParams.get('durationDays'), 10);

      let durationDays = null;
      let searchStart = startOfDay(new Date());

      if (selectedTypes.length === 0) {
        const error = new Error('Missing required query parameter: types');
        error.status = 400;
        throw error;
      }

      if (requestedStartDate || requestedEndDate) {
        if (!requestedStartDate || !requestedEndDate) {
          const error = new Error(
            'Both startDate and endDate are required when using a preferred date range'
          );
          error.status = 400;
          throw error;
        }

        const parsedStartDate = parseDateOnly(requestedStartDate);
        const parsedEndDate = parseDateOnly(requestedEndDate);

        if (!parsedStartDate || !parsedEndDate) {
          const error = new Error('startDate and endDate must be valid dates in YYYY-MM-DD format');
          error.status = 400;
          throw error;
        }

        if (parsedEndDate < parsedStartDate) {
          const error = new Error('endDate must be on or after startDate');
          error.status = 400;
          throw error;
        }

        const msPerDay = 24 * 60 * 60 * 1000;
        durationDays = Math.floor((parsedEndDate - parsedStartDate) / msPerDay) + 1;
        searchStart = startOfDay(parsedStartDate);
      } else if (Number.isInteger(requestedDurationDays) && requestedDurationDays > 0) {
        durationDays = requestedDurationDays;
      } else {
        const error = new Error('Provide either durationDays (> 0) or both startDate and endDate');
        error.status = 400;
        throw error;
      }

      const requirements = (() => {
        try {
          return JSON.parse(url.searchParams.get('requirements') || '{}');
        } catch (_) {
          return {};
        }
      })();

      return {
        status: 200,
        body: findSuggestedPackage(selectedTypes, durationDays, requirements, searchStart)
      };
    }

    if (url.pathname === '/bookings' && method === 'GET') {
      const rawEquipmentIds =
        url.searchParams.get('equipmentIds') || url.searchParams.get('equipmentId') || '';
      const equipmentIds = String(rawEquipmentIds)
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter(Number.isInteger);

      if (equipmentIds.length === 0) {
        // Return all bookings if no equipment IDs specified
        return {
          status: 200,
          body: currentBookings
        };
      }

      return {
        status: 200,
        body: getBookingRows(equipmentIds)
      };
    }

    if (url.pathname === '/bookings' && method === 'POST') {
      const payload = JSON.parse(options.body || '{}');
      return {
        status: 201,
        body: createBookings(payload)
      };
    }

    const deleteMatch = url.pathname.match(/^\/bookings\/(\d+)$/);
    if (deleteMatch && method === 'DELETE') {
      return {
        status: 200,
        body: deleteBooking(Number.parseInt(deleteMatch[1], 10))
      };
    }

    const error = new Error(`Demo endpoint not found: ${method} ${url.pathname}`);
    error.status = 404;
    throw error;
  }

  window.bookingDemoApi = {
    request(path, options) {
      try {
        const response = handleRequest(path, options);
        return createJsonResponse(response.body, response.status);
      } catch (error) {
        return createJsonResponse({ error: error.message }, error.status || 500);
      }
    },
    clear() {
      saveBookings([]);
    },
    addSeedBookings,
    reset() {
      localStorage.removeItem(STORAGE_KEY);
    }
  };
})();
