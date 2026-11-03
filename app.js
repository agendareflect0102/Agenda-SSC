/* ==========================================================
   ESTADO GLOBAL DE LA APLICACIÓN
   ========================================================== */
let currentDate = new Date();
let currentFilter = 'all';
let currentHousingDetailId = null;

// Mockup Data con estructura de Persona A, Persona B y Colonias
let housingVisits = [
    {
        id: "1029",
        colonia: "Centro",
        address: "Av. Universidad #450",
        date: "2026-11-02",
        time: "10:30",
        personA: {
            name: "Carlos Eduardo Ramírez",
            status: "pending", // 'pending', 'completed', 'rescheduled'
            rescheduleReason: "",
            checklist: {
                vitalSigns: false,
                hemoglobin: false,
                glucose: false,
                urineSample: false
            },
            pendingItems: []
        },
        personB: {
            name: "María Elena Ramírez",
            status: "pending",
            rescheduleReason: "",
            checklist: {
                vitalSigns: false,
                hemoglobin: false,
                glucose: false,
                urineSample: false
            },
            pendingItems: []
        }
    },
    {
        id: "0842",
        colonia: "Magisterial",
        address: "Calle Benito Juárez #88",
        date: "2026-11-03",
        time: "16:00",
        personA: {
            name: "Beatriz López Morales",
            status: "completed",
            rescheduleReason: "",
            checklist: {
                vitalSigns: true,
                hemoglobin: true,
                glucose: true,
                urineSample: true
            },
            pendingItems: []
        },
        personB: {
            name: "Roberto López Morales",
            status: "rescheduled",
            rescheduleReason: "No se encontraba en el domicilio durante la visita.",
            checklist: {
                vitalSigns: false,
                hemoglobin: false,
                glucose: false,
                urineSample: false
            },
            pendingItems: ["Signos vitales", "Hemoglobina", "Glucosa", "Muestra de orina"]
        }
    }
];

/* ==========================================================
   INICIALIZACIÓN
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    renderVisitsList();
    renderColoniasView();
    updateStats();
});

/* ==========================================================
   NAVEGACIÓN ENTRE PANTALLAS
   ========================================================== */
function switchView(viewId) {
    document.getElementById('view-agenda').classList.add('hidden');
    document.getElementById('view-colonias').classList.add('hidden');
    document.getElementById('view-housing-detail').classList.add('hidden');

    document.getElementById(viewId).classList.remove('hidden');

    // Actualizar botones de la barra de navegación
    document.getElementById('nav-agenda').className = viewId === 'view-agenda' 
        ? "mockup-button bg-black text-white px-3 py-1.5 text-xs font-bold uppercase" 
        : "mockup-button bg-white text-black px-3 py-1.5 text-xs font-bold uppercase";

    document.getElementById('nav-colonias').className = viewId === 'view-colonias' 
        ? "mockup-button bg-black text-white px-3 py-1.5 text-xs font-bold uppercase" 
        : "mockup-button bg-white text-black px-3 py-1.5 text-xs font-bold uppercase";

    if (viewId === 'view-colonias') {
        renderColoniasView();
    }
}

/* ==========================================================
   PANTALLA 1: CALENDARIO Y LISTA GENERAL
   ========================================================== */
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    document.getElementById('calendarMonthYear').innerText = `${monthNames[month]} ${year}`;

    const calendarDaysContainer = document.getElementById('calendarDays');
    calendarDaysContainer.innerHTML = '';

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();

    for (let x = 0; x < firstDayIndex; x++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = "h-10 bg-neutral-50 border border-neutral-200";
        calendarDaysContainer.appendChild(emptyDiv);
    }

    for (let day = 1; day <= lastDateOfMonth; day++) {
        const monthFormatted = String(month + 1).padStart(2, '0');
        const dayFormatted = String(day).padStart(2, '0');
        const dateString = `${year}-${monthFormatted}-${dayFormatted}`;

        const hasVisits = housingVisits.some(v => v.date === dateString);

        const dayBtn = document.createElement('button');
        dayBtn.type = 'button';
        dayBtn.className = `h-10 border border-black flex flex-col items-center justify-between p-1 text-xs font-bold transition hover:bg-neutral-200 ${hasVisits ? 'bg-neutral-100' : 'bg-white'}`;
        dayBtn.innerHTML = `<span>${day}</span>${hasVisits ? '<span class="w-2 h-2 bg-black rounded-full mb-0.5"></span>' : ''}`;
        dayBtn.onclick = () => openModal(dateString);

        calendarDaysContainer.appendChild(dayBtn);
    }
}

function changeMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    renderCalendar();
}

function renderVisitsList() {
    const container = document.getElementById('visitsList');
    container.innerHTML = '';

    const filtered = housingVisits.filter(item => {
        const isCompleted = item.personA.status === 'completed' && item.personB.status === 'completed';
        if (currentFilter === 'completed') return isCompleted;
        if (currentFilter === 'pending') return !isCompleted;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="mockup-card bg-white p-6 text-center text-xs font-bold uppercase">No hay visitas registradas para este filtro.</div>`;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = "mockup-card bg-white p-5 flex flex-col gap-3";
        card.innerHTML = `
            <div class="flex justify-between items-start border-b border-black pb-2">
                <div>
                    <span class="text-xs font-bold uppercase text-neutral-500">Colonia: ${item.colonia}</span>
                    <button onclick="openHousingDetail('${item.id}')" class="text-lg font-black uppercase text-left hover:underline block">
                        ID Vivienda: #${item.id}
                    </button>
                </div>
                <button onclick="openHousingDetail('${item.id}')" class="mockup-button bg-black text-white px-3 py-1 text-xs font-bold uppercase">
                    Ver Expediente
                </button>
            </div>
            <div class="text-xs space-y-1">
                <p><strong>Domicilio:</strong> ${item.address}</p>
                <p><strong>Fecha y Hora:</strong> ${item.date} - ${item.time} hrs</p>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200 text-xs">
                <div class="p-2 border border-black bg-neutral-50">
                    <p class="font-bold uppercase">${item.personA.name}</p>
                    <span class="text-[10px] font-black uppercase">${formatStatus(item.personA.status)}</span>
                </div>
                <div class="p-2 border border-black bg-neutral-50">
                    <p class="font-bold uppercase">${item.personB.name}</p>
                    <span class="text-[10px] font-black uppercase">${formatStatus(item.personB.status)}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function setFilter(filterType) {
    currentFilter = filterType;
    ['all', 'pending', 'completed'].forEach(btn => {
        document.getElementById(`filter-${btn}`).className = btn === filterType 
            ? "px-3 py-1 border border-black bg-black text-white" 
            : "px-3 py-1 border border-black bg-white";
    });
    renderVisitsList();
}

function updateStats() {
    document.getElementById('statTotal').innerText = housingVisits.length;
    const completedCount = housingVisits.filter(v => v.personA.status === 'completed' && v.personB.status === 'completed').length;
    document.getElementById('statCompleted').innerText = completedCount;
    document.getElementById('statPending').innerText = housingVisits.length - completedCount;
}

/* ==========================================================
   PANTALLA 2: SECCIÓN POR COLONIAS (CON DESPLEGABLE)
   ========================================================== */
function renderColoniasView(selectedColoniaFilter = 'all') {
    const container = document.getElementById('coloniasContainer');
    const select = document.getElementById('selectColonia');
    container.innerHTML = '';

    // 1. Agrupar todas las visitas por Colonia
    const grouped = housingVisits.reduce((acc, visit) => {
        const col = visit.colonia || 'Sin Colonia';
        if (!acc[col]) acc[col] = [];
        acc[col].push(visit);
        return acc;
    }, {});

    const coloniasList = Object.keys(grouped).sort();

    // 2. Llenar dinámicamente la lista desplegable sin perder la opción seleccionada
    select.innerHTML = '<option value="all">-- TODAS LAS COLONIAS --</option>';
    coloniasList.forEach(colonia => {
        const option = document.createElement('option');
        option.value = colonia;
        option.innerText = `${colonia.toUpperCase()} (${grouped[colonia].length})`;
        if (colonia === selectedColoniaFilter) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // 3. Filtrar las colonias a mostrar según lo elegido en el selector
    const coloniasToDisplay = selectedColoniaFilter === 'all' 
        ? coloniasList 
        : coloniasList.filter(col => col === selectedColoniaFilter);

    if (coloniasToDisplay.length === 0) {
        container.innerHTML = `<div class="col-span-2 mockup-card bg-white p-6 text-center text-xs font-bold uppercase">No se encontraron registros para la colonia seleccionada.</div>`;
        return;
    }

    // 4. Renderizar las tarjetas de cada colonia
    coloniasToDisplay.forEach(colonia => {
        const colCard = document.createElement('div');
        colCard.className = "mockup-card bg-white p-5 flex flex-col gap-3";
        
        let housesHtml = grouped[colonia].map(item => `
            <div class="border border-black p-3 bg-neutral-50 flex justify-between items-center">
                <div>
                    <strong class="text-sm font-black uppercase">Vivienda #${item.id}</strong>
                    <p class="text-xs text-neutral-600">${item.address}</p>
                    <p class="text-[10px] font-bold text-neutral-500">${item.personA.name} / ${item.personB.name}</p>
                </div>
                <button onclick="openHousingDetail('${item.id}')" class="mockup-button bg-black text-white px-3 py-1 text-xs font-bold uppercase">
                    Abrir Checklist
                </button>
            </div>
        `).join('');

        colCard.innerHTML = `
            <div class="border-b-2 border-black pb-2 flex justify-between items-center">
                <h3 class="text-lg font-black uppercase">Colonia: ${colonia}</h3>
                <span class="text-xs font-bold border border-black px-2 py-0.5 bg-neutral-200">${grouped[colonia].length} Viviendas</span>
            </div>
            <div class="flex flex-col gap-2">${housesHtml}</div>
        `;
        container.appendChild(colCard);
    });
}

// Función ejecutada cuando el usuario cambia el valor de la lista desplegable
function filterColoniaView(coloniaValue) {
    renderColoniasView(coloniaValue);
}

/* ==========================================================
   PANTALLA 3: CHECKLIST Y ESTADOS POR PERSONA
   ========================================================== */
function openHousingDetail(housingId) {
    currentHousingDetailId = housingId;
    const housing = housingVisits.find(v => v.id === housingId);
    if (!housing) return;

    document.getElementById('detailHousingTitle').innerText = `Vivienda ID: #${housing.id}`;
    document.getElementById('detailHousingAddress').innerText = `Domicilio: ${housing.address} (Cita: ${housing.date} - ${housing.time} hrs)`;
    document.getElementById('detailHousingColonia').innerText = housing.colonia;

    renderParticipantsDetail(housing);
    switchView('view-housing-detail');
}

function renderParticipantsDetail(housing) {
    const container = document.getElementById('participantsDetailContainer');
    container.innerHTML = '';

    ['personA', 'personB'].forEach((key, idx) => {
        const person = housing[key];
        const label = idx === 0 ? 'Persona A' : 'Persona B';
        
        const card = document.createElement('div');
        card.className = "mockup-card bg-white p-5 flex flex-col gap-4";

        card.innerHTML = `
            <div class="border-b-2 border-black pb-2 flex justify-between items-center">
                <div>
                    <span class="text-[10px] font-black uppercase bg-neutral-200 px-1.5 py-0.5 border border-black">${label}</span>
                    <h3 class="text-xl font-black uppercase mt-1">${person.name}</h3>
                </div>
                <span class="text-xs font-bold uppercase px-2 py-1 border border-black ${getStatusBadgeClass(person.status)}">
                    ${formatStatus(person.status)}
                </span>
            </div>

            <!-- Botones de Acción / Confirmación -->
            <div class="flex gap-2">
                <button onclick="confirmParticipant('${key}')" class="mockup-button bg-black text-white text-xs font-bold px-3 py-1.5 uppercase flex-1">
                    ✓ Confirmar Atendido
                </button>
                <button onclick="toggleRescheduleForm('${key}', true)" class="mockup-button bg-white text-black text-xs font-bold px-3 py-1.5 uppercase flex-1">
                    ↻ Reagendar
                </button>
            </div>

            <!-- Formulario de Reagendado -->
            <div id="rescheduleForm-${key}" class="hidden flex-col gap-2 p-3 bg-neutral-100 border border-black">
                <label class="text-xs font-bold uppercase">Motivo del Reagendado:</label>
                <input type="text" id="rescheduleReasonInput-${key}" value="${person.rescheduleReason}" placeholder="Ej. No se encontró en casa..." class="w-full p-2 border border-black text-xs">
                <div class="flex justify-end gap-2">
                    <button onclick="toggleRescheduleForm('${key}', false)" class="px-2 py-1 bg-white text-xs font-bold border border-black uppercase">Cancelar</button>
                    <button onclick="saveReschedule('${key}')" class="px-2 py-1 bg-black text-white text-xs font-bold border border-black uppercase">Guardar Motivo</button>
                </div>
            </div>

            <!-- Checklist de Procedimientos Médicos -->
            <div class="border-t border-black pt-3">
                <h4 class="text-xs font-black uppercase mb-2">Checklist de Procedimientos:</h4>
                <div class="space-y-2 text-xs font-semibold">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" ${person.checklist.vitalSigns ? 'checked' : ''} onchange="updateChecklist('${key}', 'vitalSigns', this.checked)" class="w-4 h-4 border-2 border-black accent-black">
                        <span>Signos vitales</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" ${person.checklist.hemoglobin ? 'checked' : ''} onchange="updateChecklist('${key}', 'hemoglobin', this.checked)" class="w-4 h-4 border-2 border-black accent-black">
                        <span>Hemoglobina</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" ${person.checklist.glucose ? 'checked' : ''} onchange="updateChecklist('${key}', 'glucose', this.checked)" class="w-4 h-4 border-2 border-black accent-black">
                        <span>Glucosa</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" ${person.checklist.urineSample ? 'checked' : ''} onchange="updateChecklist('${key}', 'urineSample', this.checked)" class="w-4 h-4 border-2 border-black accent-black">
                        <span>Muestra de orina</span>
                    </label>
                </div>
            </div>

            <!-- Apartado Automático de Pendientes -->
            <div class="border-t border-dashed border-black pt-3 bg-neutral-50 p-3">
                <h4 class="text-xs font-black uppercase text-neutral-700">Pendientes por realizar:</h4>
                <div class="mt-1">
                    ${renderPendingList(person)}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

/* ==========================================================
   LÓGICA DE NEGOCIO Y ACTUALIZACIONES
   ========================================================== */
function updateChecklist(personKey, itemKey, isChecked) {
    const housing = housingVisits.find(v => v.id === currentHousingDetailId);
    if (!housing) return;

    housing[personKey].checklist[itemKey] = isChecked;
    recalculatePendings(housing[personKey]);
    renderParticipantsDetail(housing);
}

function recalculatePendings(person) {
    const labels = {
        vitalSigns: "Signos vitales",
        hemoglobin: "Hemoglobina",
        glucose: "Glucosa",
        urineSample: "Muestra de orina"
    };

    person.pendingItems = [];
    Object.keys(person.checklist).forEach(key => {
        if (!person.checklist[key]) {
            person.pendingItems.push(labels[key]);
        }
    });

    if (person.pendingItems.length === 0) {
        person.status = 'completed';
    } else if (person.status === 'completed') {
        person.status = 'pending';
    }
}

function renderPendingList(person) {
    if (person.status === 'rescheduled') {
        return `<span class="text-xs font-bold italic text-neutral-600">Persona marcada como reagendada. Motivo: "${person.rescheduleReason || 'Sin motivo'}"</span>`;
    }

    if (!person.pendingItems || person.pendingItems.length === 0) {
        return `<span class="text-xs font-black text-black">✓ Todos los procedimientos completados.</span>`;
    }

    return `
        <ul class="list-disc list-inside text-xs font-bold text-neutral-800 space-y-0.5">
            ${person.pendingItems.map(item => `<li>${item}</li>`).join('')}
        </ul>
    `;
}

function confirmParticipant(personKey) {
    const housing = housingVisits.find(v => v.id === currentHousingDetailId);
    if (!housing) return;

    // Marcar todo el checklist como completado al confirmar
    Object.keys(housing[personKey].checklist).forEach(k => housing[personKey].checklist[k] = true);
    housing[personKey].status = 'completed';
    housing[personKey].pendingItems = [];

    renderParticipantsDetail(housing);
    renderVisitsList();
    updateStats();
}

function toggleRescheduleForm(personKey, show) {
    const el = document.getElementById(`rescheduleForm-${personKey}`);
    if (show) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

function saveReschedule(personKey) {
    const housing = housingVisits.find(v => v.id === currentHousingDetailId);
    if (!housing) return;

    const reason = document.getElementById(`rescheduleReasonInput-${personKey}`).value.trim();
    if (!reason) {
        alert("Por favor ingrese un motivo.");
        return;
    }

    housing[personKey].status = 'rescheduled';
    housing[personKey].rescheduleReason = reason;
    recalculatePendings(housing[personKey]);

    renderParticipantsDetail(housing);
    renderVisitsList();
    updateStats();
}

function formatStatus(status) {
    if (status === 'completed') return '✓ Completado';
    if (status === 'rescheduled') return '↻ Reagendado';
    return '⏱ Pendiente';
}

function getStatusBadgeClass(status) {
    if (status === 'completed') return 'bg-black text-white';
    if (status === 'rescheduled') return 'bg-neutral-300 text-black';
    return 'bg-neutral-100 text-black';
}

/* ==========================================================
   MODAL Y FORMULARIO
   ========================================================== */
function openModal(defaultDate = '') {
    const form = document.getElementById('visitForm');
    form.reset();

    const today = defaultDate || new Date().toISOString().split('T')[0];
    document.getElementById('inputDate').value = today;
    document.getElementById('visitModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('visitModal').classList.add('hidden');
}

function handleFormSubmit(event) {
    event.preventDefault();

    const newVisit = {
        id: document.getElementById('inputHousingId').value.trim(),
        colonia: document.getElementById('inputColonia').value.trim(),
        address: document.getElementById('inputAddress').value.trim(),
        date: document.getElementById('inputDate').value,
        time: document.getElementById('inputTime').value,
        personA: {
            name: document.getElementById('inputPersonA').value.trim(),
            status: 'pending',
            rescheduleReason: '',
            checklist: { vitalSigns: false, hemoglobin: false, glucose: false, urineSample: false },
            pendingItems: ["Signos vitales", "Hemoglobina", "Glucosa", "Muestra de orina"]
        },
        personB: {
            name: document.getElementById('inputPersonB').value.trim(),
            status: 'pending',
            rescheduleReason: '',
            checklist: { vitalSigns: false, hemoglobin: false, glucose: false, urineSample: false },
            pendingItems: ["Signos vitales", "Hemoglobina", "Glucosa", "Muestra de orina"]
        }
    };

    housingVisits.unshift(newVisit);

    renderVisitsList();
    renderCalendar();
    updateStats();
    closeModal();
}