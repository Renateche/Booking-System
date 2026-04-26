// ----------------------------------------------------
// Element references
// ----------------------------------------------------
const bookingSection = document.getElementById('bookingSection');
const bookingForm = document.getElementById('bookingForm');
const bookingsTableBody = document.querySelector('#bookingsTable tbody');
const noBookings = document.getElementById('noBookings');

const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const bookedByInput = document.getElementById('bookedBy');
const noteInput = document.getElementById('note');
const formMessage = document.getElementById('formMessage');
const bookingReceiptCardEl = document.getElementById('bookingReceiptCard');
const bookingReceiptTextEl = document.getElementById('bookingReceiptText');
const copyReceiptBtn = document.getElementById('copyReceiptBtn');

const calendarSection = document.getElementById('calendarSection');
const calendarWrapper = document.getElementById('calendarWrapper');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const clearDatesBtn = document.getElementById('clearDatesBtn');
const calendarSelectionState = document.getElementById('calendarSelectionState');

// ----------------------------------------------------
// Step 1 – Type suggestion references
// ----------------------------------------------------
const typeOptionsEl = document.getElementById('typeOptions');
const selectedTypeChipsEl = document.getElementById('selectedTypeChips');
const bookingDurationInput = document.getElementById('bookingDurationDays');
const suggestAvailabilityBtn = document.getElementById('suggestAvailabilityBtn');
const suggestionMessageEl = document.getElementById('suggestionMessage');
const suggestedSlotCardEl = document.getElementById('suggestedSlotCard');
const suggestedEquipmentNameEl = document.getElementById('suggestedEquipmentName');
const suggestedEquipmentTypeEl = document.getElementById('suggestedEquipmentType');
const suggestedDateRangeEl = document.getElementById('suggestedDateRange');
const suggestedDurationEl = document.getElementById('suggestedDuration');
const suggestedEquipmentList = document.getElementById('suggestedEquipmentList');
const useSuggestedSlotBtn = document.getElementById('useSuggestedSlotBtn');
const demoBadge = document.getElementById('demoBadge');
const pageSubtitle = document.getElementById('pageSubtitle');
const nextStepBanner = document.getElementById('nextStepBanner');
const nextStepCopy = document.getElementById('nextStepCopy');
const bookingSectionHint = document.getElementById('bookingSectionHint');

// ----------------------------------------------------
// Theme toggle
// ----------------------------------------------------
const themeToggleBtn = document.getElementById('themeToggleBtn');
const newBookingBtn = document.getElementById('newBookingBtn');
const addDemoBtn = document.getElementById('addDemoBtn');
const clearDemoBtn = document.getElementById('clearDemoBtn');

// Equipment search section references
const equipmentSearchSelect = document.getElementById('equipmentSearch');
const toggleSearchBtn = document.getElementById('toggleSearchBtn');
const searchContent = document.getElementById('searchContent');
const equipmentBookingsTable = document.getElementById('equipmentBookingsTable');
const equipmentBookingsTableBody = document.querySelector('#equipmentBookingsTable tbody');
const noEquipmentBookings = document.getElementById('noEquipmentBookings');

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
  document.body.classList.add('dark');
}

newBookingBtn?.addEventListener('click', () => {
  startNewBooking();
});

themeToggleBtn?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

// ----------------------------------------------------
// State
// ----------------------------------------------------
let currentBookings = [];
let calendarOffset = 0;
const MAX_MONTH_OFFSET = 12;

let selectedStartDate = null;
let selectedEndDate = null;

// Step 1 state
let activeEquipmentIds = [];
let activeEquipmentSummaries = [];
let availableTypes = [];
let selectedTypes = new Set();
let selectedTypeRequirements = {};
let suggestedSlot = null;

const appConfig = window.BOOKING_APP_CONFIG || {};
const apiBasePath = String(appConfig.apiBasePath || '').replace(/\/$/, '');
const useDemoApi = Boolean(appConfig.demoMode && window.bookingDemoApi);

if (appConfig.demoMode && demoBadge) {
  demoBadge.style.display = 'inline-flex';
}

if (appConfig.demoMode && pageSubtitle) {
  pageSubtitle.textContent = 'Sample data only';
}

if (appConfig.demoMode && addDemoBtn) {
  addDemoBtn.style.display = 'inline-block';
  addDemoBtn.addEventListener('click', () => {
    window.bookingDemoApi.addSeedBookings();
    startNewBooking();
  });
}

if (appConfig.demoMode && clearDemoBtn) {
  clearDemoBtn.style.display = 'inline-block';
  clearDemoBtn.addEventListener('click', () => {
    if (!confirm('Clear all demo bookings?')) return;
    window.bookingDemoApi.clear();
    startNewBooking();
  });
}

function apiFetch(path, options) {
  if (useDemoApi) {
    return window.bookingDemoApi.request(path, options);
  }

  return fetch(`${apiBasePath}${path}`, options);
}

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
function setBookingSectionEnabled(enabled) {
  bookingSection.classList.toggle('disabled', !enabled);

  if (bookingSectionHint) {
    bookingSectionHint.textContent = enabled
      ? 'Step 2: confirm the suggested dates below, adjust them if needed, then submit the form.'
      : 'Complete Step 1 first. When a suggestion is ready, review the dates below and then confirm this booking here.';
  }
}

function hideNextStepBanner() {
  if (nextStepBanner) {
    nextStepBanner.style.display = 'none';
  }
}

function showNextStepBanner(message) {
  if (!nextStepBanner || !nextStepCopy) {
    return;
  }

  nextStepCopy.textContent = message;
  nextStepBanner.style.display = 'block';
}

function scrollToReviewStep() {
  const target = calendarSection.style.display !== 'none' ? calendarSection : bookingSection;

  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addOneDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function formatMonthYear(date) {
  return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

function syncFormWithCalendar(showFeedback = false) {
  startInput.value = selectedStartDate || '';
  endInput.value = selectedEndDate || selectedStartDate || '';

  if (showFeedback && selectedStartDate) {
    // Flash highlight on form date inputs
    startInput.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
    endInput.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';

    setTimeout(() => {
      startInput.style.backgroundColor = '';
      endInput.style.backgroundColor = '';
    }, 1500);

    // Scroll form into view if needed
    if (
      bookingForm.offsetParent === null ||
      bookingForm.getBoundingClientRect().bottom < window.innerHeight
    ) {
      // Form is visible or below viewport, no scroll needed
    } else {
      bookingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function resetSelection() {
  selectedStartDate = null;
  selectedEndDate = null;
  syncFormWithCalendar();
}

function startNewBooking() {
  // Clear all type selections
  selectedTypes.clear();
  selectedTypeRequirements = {};
  renderTypeOptions();
  renderSelectedTypeChips();

  // Reset duration
  document.getElementById('bookingDurationDays').value = '1';

  // Clear suggestion state
  clearSuggestionState();
  hideNextStepBanner();
  activeEquipmentIds = [];
  activeEquipmentSummaries = [];

  // Hide and reset booking form
  bookingSection.classList.add('disabled');
  bookingForm.reset();
  bookedByInput.value = localStorage.getItem('bookedBy') || '';

  // Hide receipt
  hideBookingReceipt();

  // Hide calendar section
  calendarSection.style.display = 'none';
  bookingsTableBody.innerHTML = '';
  calendarOffset = 0;

  // Reset selection and calendar
  resetSelection();

  // Reload bookings
  loadBookings();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function clearSuggestionState(message = 'Choose at least one type to request a suggested slot.') {
  suggestedSlot = null;
  suggestedSlotCardEl.style.display = 'none';
  suggestionMessageEl.textContent = message;
  hideNextStepBanner();
}

function hideBookingReceipt() {
  bookingReceiptCardEl.style.display = 'none';
  bookingReceiptCardEl.style.minHeight = '';
  bookingReceiptTextEl.value = '';
}

function syncBookingReceiptHeight() {
  if (!bookingForm || !bookingReceiptCardEl || bookingReceiptCardEl.style.display === 'none') {
    return;
  }

  bookingReceiptCardEl.style.minHeight = `${bookingForm.offsetHeight}px`;
}

function formatEquipmentSummary(equipment) {
  return equipment.ipAddress
    ? `${equipment.equipmentName} (${equipment.ipAddress})`
    : equipment.equipmentName;
}

function buildBookingReceipt({ equipments, requestedTypes, startDate, endDate, bookedBy, note }) {
  const lines = [
    'Equipment booking receipt',
    '',
    'Booked equipment:',
    ...equipments.map(
      (equipment) => `- ${formatEquipmentSummary(equipment)} [${equipment.equipmentType}]`
    ),
    requestedTypes?.length ? `Requested types: ${requestedTypes.join(', ')}` : null,
    `- Dates: ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`,
    `- Booked by: ${bookedBy}`,
    note ? `- Note: ${note}` : null
  ].filter(Boolean);

  return lines.join('\n');
}

function showBookingReceipt(receiptText) {
  bookingReceiptTextEl.value = receiptText;
  bookingReceiptCardEl.style.display = 'flex';
  syncBookingReceiptHeight();
}

function getBookingsQuery(equipmentIds) {
  const normalizedIds = Array.isArray(equipmentIds) ? equipmentIds : [equipmentIds];
  const filteredIds = normalizedIds.filter((value) => Number.isInteger(value));

  if (filteredIds.length === 0) {
    return null;
  }

  if (filteredIds.length === 1) {
    return `/bookings?equipmentId=${filteredIds[0]}`;
  }

  return `/bookings?equipmentIds=${filteredIds.join(',')}`;
}

function buildRequirementsPayload() {
  const result = {};
  for (const [type, reqs] of Object.entries(selectedTypeRequirements)) {
    if (reqs.os || reqs.version) {
      result[type] = {};
      if (reqs.os) result[type].os = reqs.os;
      if (reqs.version) result[type].version = reqs.version;
    }
  }
  return result;
}

function updateSuggestButtonState() {
  const durationDays = Number.parseInt(bookingDurationInput.value, 10);
  const isDisabled =
    selectedTypes.size === 0 || !Number.isInteger(durationDays) || durationDays < 1;
  suggestAvailabilityBtn.disabled = isDisabled;
  suggestionMessageEl.style.display = isDisabled ? 'block' : 'none';
}

function renderSelectedTypeChips() {
  selectedTypeChipsEl.innerHTML = '';

  Array.from(selectedTypes)
    .sort((left, right) => left.localeCompare(right))
    .forEach((type) => {
      const chip = document.createElement('span');
      chip.className = 'selected-chip';
      chip.textContent = type;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.onclick = () => {
        selectedTypes.delete(type);
        delete selectedTypeRequirements[type];
        renderSelectedTypeChips();
        renderTypeOptions();
        clearSuggestionState();
        updateSuggestButtonState();
      };

      chip.appendChild(remove);
      selectedTypeChipsEl.appendChild(chip);
    });
}

function toggleTypeSelection(type) {
  if (selectedTypes.has(type)) {
    selectedTypes.delete(type);
    delete selectedTypeRequirements[type];
  } else {
    selectedTypes.add(type);
  }

  renderSelectedTypeChips();
  renderTypeOptions();
  clearSuggestionState();
  updateSuggestButtonState();
}

function renderTypeOptions() {
  typeOptionsEl.innerHTML = '';

  availableTypes.forEach((entry) => {
    const type = typeof entry === 'string' ? entry : entry.type;
    const osOptions = typeof entry === 'string' ? [] : (entry.osOptions || []);
    const versionOptions = typeof entry === 'string' ? [] : (entry.versionOptions || []);
    const option = document.createElement('div');
    option.className = 'type-option';

    const header = document.createElement('div');
    header.className = 'type-option-header';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `equipment-type-${type.replace(/\s+/g, '-').toLowerCase()}`;
    checkbox.checked = selectedTypes.has(type);
    checkbox.addEventListener('change', () => toggleTypeSelection(type));

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = type;

    header.appendChild(checkbox);
    header.appendChild(label);
    option.appendChild(header);

    if (selectedTypes.has(type) && (osOptions.length > 0 || versionOptions.length > 0)) {
      const reqs = document.createElement('div');
      reqs.className = 'type-requirements';

      if (osOptions.length > 0) {
        const reqRow = document.createElement('div');
        reqRow.className = 'type-requirement';
        const reqLabel = document.createElement('label');
        reqLabel.textContent = 'OS:';
        const sel = document.createElement('select');
        sel.innerHTML = '<option value="">Any</option>';
        osOptions.forEach((os) => {
          const opt = document.createElement('option');
          opt.value = os;
          opt.textContent = os;
          if ((selectedTypeRequirements[type] || {}).os === os) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
          if (!selectedTypeRequirements[type]) selectedTypeRequirements[type] = {};
          selectedTypeRequirements[type].os = sel.value;
        });
        reqRow.appendChild(reqLabel);
        reqRow.appendChild(sel);
        reqs.appendChild(reqRow);
      }

      if (versionOptions.length > 0) {
        const reqRow = document.createElement('div');
        reqRow.className = 'type-requirement';
        const reqLabel = document.createElement('label');
        reqLabel.textContent = 'Version:';
        const sel = document.createElement('select');
        sel.innerHTML = '<option value="">Any</option>';
        versionOptions.forEach((ver) => {
          const opt = document.createElement('option');
          opt.value = ver;
          opt.textContent = ver;
          if ((selectedTypeRequirements[type] || {}).version === ver) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
          if (!selectedTypeRequirements[type]) selectedTypeRequirements[type] = {};
          selectedTypeRequirements[type].version = sel.value;
        });
        reqRow.appendChild(reqLabel);
        reqRow.appendChild(sel);
        reqs.appendChild(reqRow);
      }

      option.appendChild(reqs);
    }

    typeOptionsEl.appendChild(option);
  });
}

function renderSuggestedSlot() {
  if (!suggestedSlot) {
    suggestedSlotCardEl.style.display = 'none';
    return;
  }

  if (suggestedEquipmentList) {
    suggestedEquipmentList.innerHTML = '';
    suggestedSlot.equipments.forEach((equipment) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'equipment-item';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'equipment-item-name';
      nameDiv.textContent = formatEquipmentSummary(equipment);

      const typeDiv = document.createElement('div');
      typeDiv.className = 'equipment-item-type';
      const typeParts = [equipment.equipmentType];
      if (equipment.operatingSystem) typeParts.push(equipment.operatingSystem);
      if (equipment.cimplicityVersion) typeParts.push(`v${equipment.cimplicityVersion}`);
      typeDiv.textContent = typeParts.join(' · ');

      itemDiv.appendChild(nameDiv);
      itemDiv.appendChild(typeDiv);
      suggestedEquipmentList.appendChild(itemDiv);
    });
  }

  suggestedDateRangeEl.textContent = `${formatDisplayDate(suggestedSlot.startDate)} to ${formatDisplayDate(suggestedSlot.endDate)}`;
  suggestedDurationEl.textContent = `${suggestedSlot.durationDays} day${suggestedSlot.durationDays === 1 ? '' : 's'}`;
  suggestionMessageEl.textContent =
    'Step 1 complete. Review the suggested dates below, then confirm the booking form in Step 2.';
  suggestedSlotCardEl.style.display = 'block';
}

function previewSuggestedEquipment(equipments, suggestedDates) {
  activeEquipmentIds = equipments.map((equipment) => equipment.equipmentId);
  activeEquipmentSummaries = equipments;
  setBookingSectionEnabled(activeEquipmentIds.length > 0);
  resetSelection();
  hideBookingReceipt();

  if (activeEquipmentIds.length === 0) {
    calendarSection.style.display = 'none';
    bookingsTableBody.innerHTML = '';
    noBookings.style.display = 'none';
    currentBookings = [];
    activeEquipmentSummaries = [];
    return;
  }

  calendarSection.style.display = 'block';

  apiFetch(getBookingsQuery(activeEquipmentIds))
    .then((res) => res.json())
    .then((bookings) => {
      currentBookings = bookings;
      selectedStartDate = suggestedDates.startDate;
      selectedEndDate = suggestedDates.endDate;
      syncFormWithCalendar();
      refreshCalendar();
      loadBookings(activeEquipmentIds);
      showNextStepBanner(
        'Review the suggested dates in the calendar, then use the booking form below to confirm this reservation.'
      );
    });
}

function updateActiveEquipment(equipments, suggestedDates = null) {
  activeEquipmentIds = equipments.map((equipment) => equipment.equipmentId);
  activeEquipmentSummaries = equipments;
  setBookingSectionEnabled(activeEquipmentIds.length > 0);
  resetSelection();
  hideBookingReceipt();

  if (activeEquipmentIds.length === 0) {
    calendarSection.style.display = 'none';
    bookingsTableBody.innerHTML = '';
    noBookings.style.display = 'none';
    currentBookings = [];
    activeEquipmentSummaries = [];
    return;
  }

  calendarSection.style.display = 'block';

  apiFetch(getBookingsQuery(activeEquipmentIds))
    .then((res) => res.json())
    .then((bookings) => {
      currentBookings = bookings;

      if (suggestedDates) {
        selectedStartDate = suggestedDates.startDate;
        selectedEndDate = suggestedDates.endDate;
        syncFormWithCalendar();
      }

      refreshCalendar();
      loadBookings(activeEquipmentIds);
    });
}

// ----------------------------------------------------
// Load types (shared by Step 1)
// ----------------------------------------------------
apiFetch('/equipment-types')
  .then((res) => res.json())
  .then((data) => {
    availableTypes = Array.isArray(data) ? data : [];
    renderTypeOptions();
    renderSelectedTypeChips();
    updateSuggestButtonState();
  });

// ----------------------------------------------------
// Step 1 – Type suggestion logic
// ----------------------------------------------------
bookingDurationInput.addEventListener('input', () => {
  clearSuggestionState();
  updateSuggestButtonState();
});

suggestAvailabilityBtn.addEventListener('click', () => {
  const durationDays = Number.parseInt(bookingDurationInput.value, 10);

  if (selectedTypes.size === 0 || !Number.isInteger(durationDays) || durationDays < 1) {
    updateSuggestButtonState();
    return;
  }

  const params = new URLSearchParams({
    types: Array.from(selectedTypes).join(','),
    durationDays: String(durationDays)
  });
  const requirementsPayload = buildRequirementsPayload();
  if (Object.keys(requirementsPayload).length > 0) {
    params.set('requirements', JSON.stringify(requirementsPayload));
  }

  suggestionMessageEl.textContent = 'Checking earliest availability...';

  apiFetch(`/availability-suggestion?${params.toString()}`)
    .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
    .then(({ ok, body }) => {
      if (!ok) {
        throw new Error(body.error || 'Failed to fetch suggestion');
      }

      suggestedSlot = {
        ...body,
        requestedTypes:
          body.requestedTypes ||
          Array.from(selectedTypes).sort((left, right) => left.localeCompare(right))
      };
      previewSuggestedEquipment(suggestedSlot.equipments, {
        startDate: suggestedSlot.startDate,
        endDate: suggestedSlot.endDate
      });
      renderSuggestedSlot();
    })
    .catch((error) => {
      clearSuggestionState(error.message);
    });
});

useSuggestedSlotBtn.addEventListener('click', () => {
  if (!suggestedSlot) return;

  updateActiveEquipment(suggestedSlot.equipments, {
    startDate: suggestedSlot.startDate,
    endDate: suggestedSlot.endDate
  });
});

copyReceiptBtn.addEventListener('click', async () => {
  if (!bookingReceiptTextEl.value) return;

  try {
    await navigator.clipboard.writeText(bookingReceiptTextEl.value);
    formMessage.textContent = 'Receipt copied to clipboard.';
  } catch (error) {
    bookingReceiptTextEl.focus();
    bookingReceiptTextEl.select();
    formMessage.textContent = 'Receipt ready. Press Ctrl+C to copy it.';
  }
});

// ----------------------------------------------------
// Bookings table
// ----------------------------------------------------
function loadBookings(equipmentIds) {
  bookingsTableBody.innerHTML = '';
  noBookings.style.display = 'none';

  const query = getBookingsQuery(equipmentIds);

  if (!query) {
    noBookings.style.display = 'block';
    return;
  }

  apiFetch(query)
    .then((res) => res.json())
    .then((bookings) => {
      if (bookings.length === 0) {
        noBookings.style.display = 'block';
        return;
      }

      bookings.forEach((b) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${b.equipment_name || ''}</td>
          <td>${b.start_datetime.substring(0, 10)}</td>
          <td>${b.end_datetime.substring(0, 10)}</td>
          <td>${b.booked_by}</td>
          <td>${b.note || ''}</td>
          <td><button class="danger-btn">❌</button></td>
        `;

        row.querySelector('button').addEventListener('click', () => {
          if (!confirm(`Cancel booking by ${b.booked_by}?`)) return;
          apiFetch(`/bookings/${b.id}`, { method: 'DELETE' }).then(() =>
            refreshAfterChange(equipmentIds)
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

// Helper function to show feedback toast
function showFeedbackToast(message) {
  const toast = document.createElement('div');
  toast.className = 'date-feedback-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInUp 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Helper function to update calendar selection state display
function updateCalendarSelectionState() {
  if (!selectedStartDate) {
    calendarSelectionState.style.display = 'none';
    clearDatesBtn.style.display = 'none';
    return;
  }

  clearDatesBtn.style.display = 'block';
  calendarSelectionState.style.display = 'block';

  const startFormatted = new Date(selectedStartDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  if (!selectedEndDate) {
    calendarSelectionState.textContent = `Start: ${startFormatted} (click again to set end date)`;
  } else {
    const endFormatted = new Date(selectedEndDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const dayCount = Math.floor(
      (new Date(selectedEndDate) - new Date(selectedStartDate)) / (1000 * 60 * 60 * 24)
    );
    calendarSelectionState.textContent = `${startFormatted} – ${endFormatted} (${dayCount} day${dayCount !== 1 ? 's' : ''})`;
  }
}

function onCalendarDateClick(dateStr) {
  if (!selectedStartDate) {
    selectedStartDate = dateStr;
    selectedEndDate = null;
    showFeedbackToast('✓ Start date set');
  } else if (!selectedEndDate) {
    if (dateStr < selectedStartDate) {
      selectedEndDate = selectedStartDate;
      selectedStartDate = dateStr;
    } else {
      selectedEndDate = dateStr;
    }
    showFeedbackToast('✓ End date set');
  } else {
    selectedStartDate = dateStr;
    selectedEndDate = null;
    showFeedbackToast('✓ Selection reset');
  }

  syncFormWithCalendar(true);
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
      bookedByList.forEach((name, i) => {
        if (i > 0) nameEl.appendChild(document.createElement('br'));
        nameEl.appendChild(document.createTextNode(name));
      });

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
  updateCalendarSelectionState();
}

// ----------------------------------------------------
// Navigation
// ----------------------------------------------------
prevMonthBtn?.addEventListener('click', () => {
  if (calendarOffset > -MAX_MONTH_OFFSET) {
    calendarOffset--;
    refreshCalendar();
  }
});

nextMonthBtn?.addEventListener('click', () => {
  if (calendarOffset < MAX_MONTH_OFFSET) {
    calendarOffset++;
    refreshCalendar();
  }
});
clearDatesBtn?.addEventListener('click', () => {
  selectedStartDate = null;
  selectedEndDate = null;
  syncFormWithCalendar();
  refreshCalendar();
  showFeedbackToast('✓ Dates cleared');
});
// ----------------------------------------------------
// Create booking (whole days)
// ----------------------------------------------------
bookingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  formMessage.textContent = '';
  hideBookingReceipt();

  if (activeEquipmentIds.length === 0 || !selectedStartDate) return;

  const receiptData = {
    equipments: activeEquipmentSummaries,
    requestedTypes: suggestedSlot?.requestedTypes || Array.from(selectedTypes),
    startDate: selectedStartDate,
    endDate: selectedEndDate || selectedStartDate,
    bookedBy: bookedByInput.value,
    note: noteInput.value.trim()
  };

  const startDatetime = `${selectedStartDate} 00:00`;
  const endDatetime = `${addOneDay(selectedEndDate || selectedStartDate)} 00:00`;

  apiFetch('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      equipment_ids: activeEquipmentIds,
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

      showBookingReceipt(buildBookingReceipt(receiptData));
      formMessage.textContent = '';

      bookingForm.reset();
      bookedByInput.value = localStorage.getItem('bookedBy') || '';
      resetSelection();
      refreshAfterChange(activeEquipmentIds);
    });
});

// ----------------------------------------------------
// Refresh helper
// ----------------------------------------------------
function refreshAfterChange(equipmentIds) {
  const query = getBookingsQuery(equipmentIds);

  if (!query) {
    currentBookings = [];
    refreshCalendar();
    bookingsTableBody.innerHTML = '';
    noBookings.style.display = 'block';
    return;
  }

  apiFetch(query)
    .then((res) => res.json())
    .then((bookings) => {
      currentBookings = bookings;
      refreshCalendar();
      loadBookings(equipmentIds);
    });
}

// Equipment search section
let allEquipment = [];

async function loadAllEquipment() {
  try {
    const res = await apiFetch('/equipment');
    const equipment = await res.json();
    allEquipment = equipment;
    populateEquipmentSearch();
  } catch (err) {
    console.error('Failed to load equipment:', err);
  }
}

function populateEquipmentSearch() {
  equipmentSearchSelect.innerHTML = '<option value="">-- Choose equipment --</option>';
  const sortedEquipment = [...allEquipment].sort((a, b) => a.name.localeCompare(b.name));
  sortedEquipment.forEach((eq) => {
    const option = document.createElement('option');
    option.value = eq.id;
    option.textContent = `${eq.name} (${eq.ip_address || 'N/A'})`;
    equipmentSearchSelect.appendChild(option);
  });
}

function displayEquipmentBookings(equipmentId) {
  if (!equipmentId) {
    equipmentBookingsTable.style.display = 'none';
    noEquipmentBookings.style.display = 'none';
    return;
  }
  apiFetch(`/bookings?equipmentIds=${equipmentId}`)
    .then((res) => res.json())
    .then((bookings) => {
      equipmentBookingsTableBody.innerHTML = '';
      if (bookings.length === 0) {
        equipmentBookingsTable.style.display = 'none';
        noEquipmentBookings.style.display = 'block';
        return;
      }
      equipmentBookingsTable.style.display = 'table';
      noEquipmentBookings.style.display = 'none';
      bookings.forEach((booking) => {
        const row = equipmentBookingsTableBody.insertRow();
        row.innerHTML = `<td>${booking.equipment_name}</td><td>${formatDisplayDate(booking.start_datetime.split(' ')[0])}</td><td>${formatDisplayDate(booking.end_datetime.split(' ')[0])}</td><td>${booking.booked_by}</td><td>${booking.note || ''}</td>`;
      });
    })
    .catch((err) => console.error('Failed to load equipment bookings:', err));
}

toggleSearchBtn?.addEventListener('click', () => {
  const isHidden = searchContent.style.display === 'none';
  searchContent.style.display = isHidden ? 'block' : 'none';
  toggleSearchBtn.textContent = isHidden ? '−' : '+';
});

equipmentSearchSelect?.addEventListener('change', (e) => {
  displayEquipmentBookings(e.target.value);
});

loadAllEquipment();
