// ----------------------------------------------------
// Element references
// ----------------------------------------------------
const equipmentSelect = document.getElementById('equipmentSelect');
const bookingSection = document.getElementById('bookingSection');
const bookingForm = document.getElementById('bookingForm');
const bookingsTableBody = document.querySelector('#bookingsTable tbody');
const noBookings = document.getElementById('noBookings');

const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const bookedByInput = document.getElementById('bookedBy');
const noteInput = document.getElementById('note');
const formMessage = document.getElementById('formMessage');

const calendarSection = document.getElementById('calendarSection');
const calendarWrapper = document.getElementById('calendarWrapper');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');

// ----------------------------------------------------
// Theme toggle
// ----------------------------------------------------
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Load saved theme (or system preference)
const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
  document.body.classList.add('dark');
}

// Toggle theme
themeToggleBtn?.addEventListener('click', () => {
  document.body.classList.toggle('dark');

  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// ----------------------------------------------------
// State
// ----------------------------------------------------
let currentBookings = [];
let calendarOffset = 0;
const MAX_MONTH_OFFSET = 12;

let selectedStartDate = null; // YYYY-MM-DD
let selectedEndDate = null; // YYYY-MM-DD

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
function setBookingSectionEnabled(enabled) {
  bookingSection.classList.toggle('disabled', !enabled);
}
setBookingSectionEnabled(false);

bookedByInput.value = localStorage.getItem('bookedBy') || '';
bookedByInput.addEventListener('input', () => {
  localStorage.setItem('bookedBy', bookedByInput.value);
});

function addOneDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function formatMonthYear(date) {
  return date.toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric'
  });
}

function syncFormWithCalendar() {
  startInput.value = selectedStartDate || '';
  endInput.value = selectedEndDate || selectedStartDate || '';
}

function resetSelection() {
  selectedStartDate = null;
  selectedEndDate = null;
  syncFormWithCalendar();
}

// ----------------------------------------------------
// Load equipment
// ----------------------------------------------------
fetch('/equipment')
  .then((res) => res.json())
  .then((equipment) => {
    equipment.forEach((eq) => {
      const opt = document.createElement('option');
      opt.value = eq.id;
      opt.textContent = eq.name;
      equipmentSelect.appendChild(opt);
    });
  });

// ----------------------------------------------------
// Bookings table
// ----------------------------------------------------
function loadBookings(equipmentId) {
  bookingsTableBody.innerHTML = '';
  noBookings.style.display = 'none';

  fetch(`/bookings?equipmentId=${equipmentId}`)
    .then((res) => res.json())
    .then((bookings) => {
      if (bookings.length === 0) {
        noBookings.style.display = 'block';
        return;
      }

      bookings.forEach((b) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${b.start_datetime.substring(0, 10)}</td>
          <td>${b.end_datetime.substring(0, 10)}</td>
          <td>${b.booked_by}</td>
          <td>${b.note || ''}</td>
          <td><button class="danger-btn">❌</button></td>
        `;

        row.querySelector('button').addEventListener('click', () => {
          if (!confirm(`Cancel booking by ${b.booked_by}?`)) return;
          fetch(`/bookings/${b.id}`, { method: 'DELETE' }).then(() =>
            refreshAfterChange(equipmentId)
          );
        });

        bookingsTableBody.appendChild(row);
      });
    });
}

// ----------------------------------------------------
// Calendar logic
// ----------------------------------------------------
function getBookedDateMap(bookings) {
  const map = {};

  bookings.forEach((b) => {
    const start = new Date(b.start_datetime);
    const end = new Date(b.end_datetime);
    const current = new Date(start);

    while (current < end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      if (!map[dateStr]) {
        map[dateStr] = [];
      }

      if (!map[dateStr].includes(b.booked_by)) {
        map[dateStr].push(b.booked_by);
      }

      current.setDate(current.getDate() + 1);
    }
  });

  return map;
}

function onCalendarDateClick(dateStr) {
  if (!selectedStartDate) {
    selectedStartDate = dateStr;
    selectedEndDate = null;
  } else if (!selectedEndDate) {
    if (dateStr < selectedStartDate) {
      selectedEndDate = selectedStartDate;
      selectedStartDate = dateStr;
    } else {
      selectedEndDate = dateStr;
    }
  } else {
    selectedStartDate = dateStr;
    selectedEndDate = null;
  }

  syncFormWithCalendar();
  refreshCalendar();
}

function renderSingleMonth(baseDate, bookedDateMap) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const container = document.createElement('div');
  container.className = 'calendar-month';

  const title = document.createElement('div');
  title.className = 'calendar-title';
  title.textContent = formatMonthYear(baseDate);
  container.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d) => {
    const hdr = document.createElement('div');
    hdr.className = 'calendar-header';
    hdr.textContent = d;
    grid.appendChild(hdr);
  });

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day outside';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    cell.textContent = day;

    const bookedByList = bookedDateMap[dateStr];

    if (bookedByList) {
      cell.classList.add('booked');

      const nameEl = document.createElement('div');
      nameEl.className = 'calendar-booked-by';
      nameEl.textContent = bookedByList.join(', ');

      cell.appendChild(nameEl);
    } else {
      cell.addEventListener('click', () => onCalendarDateClick(dateStr));
    }

    if (selectedStartDate === dateStr || selectedEndDate === dateStr) {
      cell.classList.add('selected');
    }

    if (
      selectedStartDate &&
      selectedEndDate &&
      dateStr > selectedStartDate &&
      dateStr < selectedEndDate
    ) {
      cell.classList.add('range');
    }

    grid.appendChild(cell);
  }

  container.appendChild(grid);
  return container;
}

function renderTwoMonthCalendar(bookedDateMap) {
  calendarWrapper.innerHTML = '';

  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth() + calendarOffset, 1);
  const secondMonth = new Date(now.getFullYear(), now.getMonth() + calendarOffset + 1, 1);

  calendarWrapper.appendChild(renderSingleMonth(firstMonth, bookedDateMap));
  calendarWrapper.appendChild(renderSingleMonth(secondMonth, bookedDateMap));
}

function refreshCalendar() {
  const bookedDateMap = getBookedDateMap(currentBookings);
  renderTwoMonthCalendar(bookedDateMap);
}

// ----------------------------------------------------
// Navigation
// ----------------------------------------------------
prevMonthBtn.addEventListener('click', () => {
  if (calendarOffset > -MAX_MONTH_OFFSET) {
    calendarOffset--;
    refreshCalendar();
  }
});

nextMonthBtn.addEventListener('click', () => {
  if (calendarOffset < MAX_MONTH_OFFSET) {
    calendarOffset++;
    refreshCalendar();
  }
});

// ----------------------------------------------------
// Equipment selection (single handler)
// ----------------------------------------------------
equipmentSelect.addEventListener('change', () => {
  const equipmentId = equipmentSelect.value;
  setBookingSectionEnabled(!!equipmentId);
  resetSelection();

  if (!equipmentId) {
    calendarSection.style.display = 'none';
    bookingsTableBody.innerHTML = '';
    noBookings.style.display = 'none';
    return;
  }

  calendarSection.style.display = 'block';

  fetch(`/bookings?equipmentId=${equipmentId}`)
    .then((res) => res.json())
    .then((bookings) => {
      currentBookings = bookings;
      refreshCalendar();
      loadBookings(equipmentId);
    });
});

// ----------------------------------------------------
// Create booking (whole days)
// ----------------------------------------------------
bookingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  formMessage.textContent = '';

  const equipmentId = equipmentSelect.value;
  if (!equipmentId || !selectedStartDate) return;

  const startDatetime = `${selectedStartDate} 00:00`;
  const endDatetime = `${addOneDay(selectedEndDate || selectedStartDate)} 00:00`;

  fetch('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      equipment_id: Number(equipmentId),
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      booked_by: bookedByInput.value,
      note: noteInput.value
    })
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.error) {
        formMessage.textContent = result.error;
        return;
      }

      bookingForm.reset();
      bookedByInput.value = localStorage.getItem('bookedBy') || '';
      resetSelection();
      refreshAfterChange(equipmentId);
    });
});

// ----------------------------------------------------
// Refresh helper
// ----------------------------------------------------
function refreshAfterChange(equipmentId) {
  fetch(`/bookings?equipmentId=${equipmentId}`)
    .then((res) => res.json())
    .then((bookings) => {
      currentBookings = bookings;
      refreshCalendar();
      loadBookings(equipmentId);
    });
}
