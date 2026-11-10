/* ==========================================================
   CONFIGURACIÓN E INICIALIZACIÓN DE SUPABASE
   ========================================================== */
// Reemplaza estas variables con las credenciales reales de tu proyecto en Supabase
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_KEY = 'TU-ANON-KEY-PUBLICA';

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'https://TU-PROYECTO.supabase.co') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

/* ==========================================================
   ESTADO GLOBAL DE LA APLICACIÓN
   ========================================================== */
let housingVisits = [];
let selectedHousingForChecklist = null;

// Datos iniciales de ejemplo (Mockup Data)
const initialMockData = [
    {
        id: "V-101",
        colonia: "Centro",
        address: "Calle Hidalgo #230",
        date: "2026-11-03",
        time: "09:00",
        synced: true,
        personA: {
            name: "Carlos Eduardo Ramírez",
            status: "pending", // 'completed', 'pending', 'rescheduled'
            rescheduleReason: "",
            checklist: { vitalSigns: true, hemoglobin: false, glucose: false, urineSample: false },
            pendingItems: ["Hemoglobina", "Glucosa", "Muestra de orina"]
        },
        personB: {
            name: "María López Ramírez",
            status: "completed",
            rescheduleReason: "",
            checklist: { vitalSigns: true, hemoglobin: true, glucose: true, urineSample: true },
            pendingItems: []
        }
    },
    {
        id: "V-102",
        colonia: "Americas",
        address: "Av. Las Américas #880",
        date: "2026-11-05",
        time: "11:30",
        synced: true,
        personA: {
            name: "Beatriz Morales Téllez",
            status: "rescheduled",
            rescheduleReason: "No se encontró en el domicilio al momento del recorrido.",
            checklist: { vitalSigns: false, hemoglobin: false, glucose: false, urineSample: false },
            pendingItems: ["Signos vitales", "Hemoglobina", "Glucosa", "Muestra de orina"]
        },
        personB: {
            name: "Fernando Ruiz Morales",
            status: "pending",
            rescheduleReason: "",
            checklist: { vitalSigns: true, hemoglobin: true, glucose: false, urineSample: false },
            pendingItems: ["Glucosa", "Muestra de orina"]
        }
    }
];

/* ==========================================================
   INICIALIZACIÓN AL CARGAR LA PÁGINA
   ========================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar datos desde localStorage o inicializar con datos de ejemplo
    loadLocalVisitsData();

    // 2. Establecer fecha por defecto en el formulario (Hoy)
    const today = new Date().toISOString().split('T')[0];
    const inputDate = document.getElementById('inputDate');
    if (inputDate) inputDate.value = today;

    // 3. Escuchar evento blur en el campo ID de vivienda para autocompletar
    const inputHousingId = document.getElementById('inputHousingId');
    if (inputHousingId) {
        inputHousingId.addEventListener('blur', async () => {
            const hId = inputHousingId.value.trim();
            if (hId) {
                await autoFillHousingData(hId);
            }
        });
    }

    // 4. Sincronizar con Supabase si hay conexión a internet disponible
    if (navigator.onLine && supabaseClient) {
        await syncAllPendingVisits();
    }

    // 5. Renderizar vista inicial
    renderCitasList();
    renderColoniasCards();
    renderChecklistsView();
});

/* ==========================================================
   SISTEMA DE NAVEGACIÓN DE 4 PANTALLAS
   ========================================================== */
function switchView(viewId) {
    const views = ['view-agendar', 'view-citas', 'view-colonias', 'view-checklists'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    const activeView = document.getElementById(viewId);
    if (activeView) activeView.classList.remove('hidden');

    // Botones activos en Azul Cobalto (bg-sky-600) y pasivos en Blanco (bg-white)
    const navs = ['agendar', 'citas', 'colonias', 'checklists'];
    navs.forEach(n => {
        const btn = document.getElementById(`nav-${n}`);
        if (btn) {
            if (`view-${n}` === viewId) {
                btn.className = "mockup-button bg-sky-600 text-white px-3 py-1.5 text-xs font-bold uppercase";
            } else {
                btn.className = "mockup-button bg-white text-sky-950 px-3 py-1.5 text-xs font-bold uppercase";
            }
        }
    });

    // Refrescar vistas específicas al cambiar de pestaña
    if (viewId === 'view-citas') renderCitasList();
    if (viewId === 'view-colonias') renderColoniasCards();
    if (viewId === 'view-checklists') renderChecklistsView();
}

/* ==========================================================
   ALERTA GLOBAL (Toast Notification)
   ========================================================== */
function showAlert(message) {
    const toast = document.getElementById('alertToast');
    const msgEl = document.getElementById('alertMessage');
    if (!toast || !msgEl) return;

    msgEl.innerText = message;
    toast.classList.remove('translate-y-[-150%]');
    toast.classList.add('translate-y-0');

    setTimeout(() => {
        toast.classList.remove('translate-y-0');
        toast.classList.add('translate-y-[-150%]');
    }, 3500);
}

/* ==========================================================
   GESTIÓN DE DATOS LOCALES (LOCALSTORAGE & OFFLINE)
   ========================================================== */
function loadLocalVisitsData() {
    const localData = localStorage.getItem('reflect_visits');
    if (localData) {
        housingVisits = JSON.parse(localData);
    } else {
        housingVisits = [...initialMockData];
        saveVisitsToLocalStorage();
    }
}

function saveVisitsToLocalStorage() {
    localStorage.setItem('reflect_visits', JSON.stringify(housingVisits));
}

// Evento que detecta cuando se recupera la conexión a internet
window.addEventListener('online', async () => {
    showAlert("📶 Conexión restablecida. Sincronizando datos con Supabase...");
    if (supabaseClient) {
        await syncAllPendingVisits();
    }
});

/* ==========================================================
   INTEGRACIÓN CON SUPABASE (AUTOCOMPLETADO Y SINCRONIZACIÓN)
   ========================================================== */
async function autoFillHousingData(housingId) {
    // 1. Buscar primero en el almacenamiento local
    const localHousing = housingVisits.find(h => h.id.toLowerCase() === housingId.toLowerCase());
    if (localHousing) {
        fillFormFields(localHousing.colonia, localHousing.address, localHousing.personA.name, localHousing.personB.name);
        showAlert(`✓ Datos de la vivienda #${housingId} recuperados localmente.`);
        return;
    }

    // 2. Si hay conexión, consultar la base de datos de Supabase
    if (navigator.onLine && supabaseClient) {
        try {
            const { data: vivienda, error } = await supabaseClient
                .from('viviendas')
                .select(`
                    colonia,
                    address,
                    participantes ( rol, nombre )
                `)
                .eq('housing_id', housingId)
                .single();

            if (vivienda) {
                const pA = vivienda.participantes.find(p => p.rol === 'PersonaA');
                const pB = vivienda.participantes.find(p => p.rol === 'PersonaB');
                fillFormFields(
                    vivienda.colonia,
                    vivienda.address,
                    pA ? pA.nombre : '',
                    pB ? pB.nombre : ''
                );
                showAlert(`✓ Datos de la vivienda #${housingId} autocompletados desde Supabase.`);
            }
        } catch (err) {
            console.warn('Registro nuevo o error al consultar Supabase:', err);
        }
    }
}

function fillFormFields(colonia, address, personAName, personBName) {
    const inputColonia = document.getElementById('inputColonia');
    const inputAddress = document.getElementById('inputAddress');
    const inputPersonA = document.getElementById('inputPersonA');
    const inputPersonB = document.getElementById('inputPersonB');

    if (inputColonia) inputColonia.value = colonia || '';
    if (inputAddress) inputAddress.value = address || '';
    if (inputPersonA) inputPersonA.value = personAName || '';
    if (inputPersonB) inputPersonB.value = personBName || '';
}

async function syncSingleVisitToSupabase(visit) {
    if (!supabaseClient || !navigator.onLine) return false;

    try {
        const { data: viviendaData, error: viviendaErr } = await supabaseClient
            .from('viviendas')
            .upsert({ housing_id: visit.id, colonia: visit.colonia, address: visit.address }, { onConflict: 'housing_id' })
            .select()
            .single();

        if (viviendaErr) throw viviendaErr;

        for (const roleKey of ['personA', 'personB']) {
            const person = visit[roleKey];
            const rolName = roleKey === 'personA' ? 'PersonaA' : 'PersonaB';

            const { data: partData, error: partErr } = await supabaseClient
                .from('participantes')
                .upsert({
                    vivienda_id: viviendaData.id,
                    rol: rolName,
                    nombre: person.name,
                    status: person.status,
                    reschedule_reason: person.rescheduleReason
                })
                .select()
                .single();

            if (partErr) throw partErr;

            await supabaseClient
                .from('checklists')
                .upsert({
                    participante_id: partData.id,
                    vital_signs: person.checklist.vitalSigns,
                    hemoglobin: person.checklist.hemoglobin,
                    glucose: person.checklist.glucose,
                    urine_sample: person.checklist.urineSample
                });
        }

        visit.synced = true;
        saveVisitsToLocalStorage();
        return true;
    } catch (err) {
        console.error('Error al sincronizar con Supabase:', err);
        return false;
    }
}

async function syncAllPendingVisits() {
    for (let visit of housingVisits) {
        if (!visit.synced) {
            await syncSingleVisitToSupabase(visit);
        }
    }
}

/* ==========================================================
   PANTALLA 1: AGENDAR NUEVA VISITA
   ========================================================== */
async function handleAgendarSubmit(event) {
    event.preventDefault();

    const newVisit = {
        id: document.getElementById('inputHousingId').value.trim(),
        colonia: document.getElementById('inputColonia').value.trim(),
        address: document.getElementById('inputAddress').value.trim(),
        date: document.getElementById('inputDate').value,
        time: document.getElementById('inputTime').value,
        synced: false,
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
    saveVisitsToLocalStorage();

    if (navigator.onLine && supabaseClient) {
        await syncSingleVisitToSupabase(newVisit);
        showAlert(`¡Visita a la vivienda #${newVisit.id} registrada y sincronizada!`);
    } else {
        showAlert(`⚠️ Guardado en el dispositivo (sin conexión). Se sincronizará al detectar red.`);
    }

    document.getElementById('agendarForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inputDate').value = today;

    switchView('view-citas');
}

/* ==========================================================
   PANTALLA 2: CITAS PROGRAMADAS
   ========================================================== */
function renderCitasList() {
    const container = document.getElementById('citasListContainer');
    const selectFilter = document.getElementById('filterColoniaCitas');
    if (!container || !selectFilter) return;

    const currentColonia = selectFilter.value;

    const colonias = [...new Set(housingVisits.map(v => v.colonia))].sort();
    selectFilter.innerHTML = '<option value="all">-- TODAS LAS COLONIAS --</option>';
    colonias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.innerText = c.toUpperCase();
        if (c === currentColonia) opt.selected = true;
        selectFilter.appendChild(opt);
    });

    const filtered = currentColonia === 'all'
        ? housingVisits
        : housingVisits.filter(v => v.colonia === currentColonia);

    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-3 mockup-card bg-white p-6 text-center text-xs font-bold uppercase text-slate-500">No hay citas registradas en esta colonia.</div>`;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = "mockup-card p-4 flex flex-col justify-between gap-3 bg-white";
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start border-b border-slate-900 pb-2 mb-2">
                    <div>
                        <span class="text-[10px] font-black uppercase bg-sky-950 text-white px-1.5 py-0.5">ID: ${item.id}</span>
                        <h3 class="text-sm font-black uppercase text-sky-950 mt-1">${item.colonia}</h3>
                    </div>
                    <span class="text-[10px] font-bold border border-slate-900 px-2 py-0.5 bg-sky-50">${item.date}</span>
                </div>
                <p class="text-xs font-semibold text-slate-800"><strong>Dirección:</strong> ${item.address}</p>
                <p class="text-xs font-semibold text-slate-800"><strong>Hora:</strong> ${item.time} hrs</p>

                <div class="mt-3 pt-2 border-t border-slate-200 space-y-1.5">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold truncate">${item.personA.name}</span>
                        ${renderStatusBadge(item.personA.status)}
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold truncate">${item.personB.name}</span>
                        ${renderStatusBadge(item.personB.status)}
                    </div>
                </div>
            </div>

            <button onclick="goToChecklistForHousing('${item.id}')" class="mockup-button bg-sky-600 text-white text-[11px] font-bold py-1.5 uppercase w-full mt-2">
                Ver / Capturar Checklist
            </button>
        `;
        container.appendChild(card);
    });
}

function renderStatusBadge(status) {
    if (status === 'completed') {
        return `<span class="bg-emerald-100 text-emerald-800 border border-emerald-800 text-[10px] font-black px-2 py-0.5 uppercase">✓ Completado</span>`;
    }
    if (status === 'rescheduled') {
        return `<span class="bg-rose-100 text-rose-800 border border-rose-800 text-[10px] font-black px-2 py-0.5 uppercase">✕ Reagendado</span>`;
    }
    return `<span class="bg-amber-100 text-amber-900 border border-amber-800 text-[10px] font-black px-2 py-0.5 uppercase">⏱ Pendiente</span>`;
}

function goToChecklistForHousing(housingId) {
    selectedHousingForChecklist = housingId;
    switchView('view-checklists');
}

/* ==========================================================
   PANTALLA 3: ORGANIZACIÓN POR COLONIA
   ========================================================== */
function renderColoniasCards() {
    const container = document.getElementById('coloniasCardsContainer');
    if (!container) return;
    container.innerHTML = '';

    const grouped = housingVisits.reduce((acc, visit) => {
        const col = visit.colonia || 'Sin Colonia';
        if (!acc[col]) acc[col] = [];
        acc[col].push(visit);
        return acc;
    }, {});

    Object.keys(grouped).forEach(colonia => {
        const colCard = document.createElement('div');
        colCard.className = "mockup-card p-5 flex flex-col gap-3 bg-white";

        const housesList = grouped[colonia].map(h => `
            <div class="p-3 border border-slate-900 bg-sky-50/50 flex justify-between items-center text-xs">
                <div>
                    <strong class="font-black uppercase text-sm block text-sky-950">Vivienda #${h.id}</strong>
                    <p class="text-slate-700">${h.address}</p>
                    <p class="text-[10px] text-slate-500 font-bold mt-0.5">${h.personA.name} y ${h.personB.name}</p>
                </div>
                <div class="text-right">
                    <span class="font-bold block text-slate-900">${h.date}</span>
                    <span class="text-[10px] font-semibold text-slate-600">${h.time} hrs</span>
                </div>
            </div>
        `).join('');

        colCard.innerHTML = `
            <div class="border-b-2 border-sky-900 pb-2 flex justify-between items-center">
                <h3 class="text-lg font-black uppercase text-sky-950">${colonia}</h3>
                <span class="text-xs font-bold border border-slate-900 px-2 py-0.5 bg-sky-100 text-sky-900">${grouped[colonia].length} Casas</span>
            </div>
            <div class="flex flex-col gap-2">${housesList}</div>
        `;
        container.appendChild(colCard);
    });
}

/* ==========================================================
   PANTALLA 4: CHECKLISTS & PENDIENTES (CON FILTRO DE COLONIAS)
   ========================================================== */
function renderChecklistsView() {
    renderPriorityPendingList();
    populateColoniaFilterChecklist();
}

// 1. Poblar el filtro desplegable de Colonias en la pantalla de Checklist
function populateColoniaFilterChecklist() {
    const selectColonia = document.getElementById('selectColoniaChecklist');
    if (!selectColonia) return;

    const currentSelectedColonia = selectColonia.value || 'all';
    const colonias = [...new Set(housingVisits.map(v => v.colonia))].sort();

    selectColonia.innerHTML = '<option value="all">-- TODAS LAS COLONIAS --</option>';
    colonias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.innerText = c.toUpperCase();
        if (c === currentSelectedColonia) opt.selected = true;
        selectColonia.appendChild(opt);
    });

    filterChecklistViviendasByColonia(selectColonia.value);
}

// 2. Filtrar las viviendas mostradas en el segundo selector según la colonia elegida
function filterChecklistViviendasByColonia(coloniaValue) {
    const selectHousing = document.getElementById('selectHousingDetail');
    if (!selectHousing) return;

    selectHousing.innerHTML = '';

    const filteredVisits = coloniaValue === 'all'
        ? housingVisits
        : housingVisits.filter(v => v.colonia === coloniaValue);

    if (filteredVisits.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.innerText = "NO HAY VIVIENDAS DISPONIBLES";
        selectHousing.appendChild(opt);
        renderHousingChecklistDetail(null);
        return;
    }

    filteredVisits.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.innerText = `Vivienda #${h.id} (${h.colonia}) - ${h.address}`;
        if (h.id === selectedHousingForChecklist) opt.selected = true;
        selectHousing.appendChild(opt);
    });

    const currentExistInFilter = filteredVisits.some(v => v.id === selectedHousingForChecklist);
    if (!currentExistInFilter && filteredVisits.length > 0) {
        selectedHousingForChecklist = filteredVisits[0].id;
        selectHousing.value = selectedHousingForChecklist;
    }

    renderHousingChecklistDetail(selectedHousingForChecklist);
}

// 3. Renderizar las tarjetas de la vivienda seleccionada con diseño moderno
function renderHousingChecklistDetail(housingId) {
    selectedHousingForChecklist = housingId;
    const area = document.getElementById('checklistDetailArea');
    if (!area) return;

    if (!housingId) {
        area.innerHTML = `<div class="p-8 text-center text-xs font-bold text-slate-400 uppercase bg-slate-50 border border-dashed border-slate-200 rounded-lg">No hay viviendas registradas para la colonia seleccionada.</div>`;
        return;
    }

    const housing = housingVisits.find(h => h.id === housingId);

    if (!housing) {
        area.innerHTML = `<div class="p-8 text-center text-xs font-bold text-slate-400 uppercase bg-slate-50 border border-dashed border-slate-200 rounded-lg">No se encontró la información de la vivienda.</div>`;
        return;
    }

    area.innerHTML = `
        <div class="bg-sky-50/80 p-4 rounded-lg border border-sky-200 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-xs text-sky-950">
            <div>
                <span class="font-extrabold uppercase bg-sky-950 text-white px-2 py-0.5 rounded text-[10px] mr-2">Vivienda #${housing.id}</span>
                <strong>Colonia:</strong> ${housing.colonia} | <strong>Dirección:</strong> ${housing.address}
            </div>
            <div class="bg-white px-3 py-1 rounded border border-sky-200 font-bold text-sky-900 shadow-sm">
                📅 Cita: ${housing.date} a las ${housing.time} hrs
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            ${renderPersonChecklistCardModern(housing, 'personA', 'Persona A')}
            ${renderPersonChecklistCardModern(housing, 'personB', 'Persona B')}
        </div>
    `;
}

// 4. Plantilla visual limpia y moderna para Persona A y Persona B
function renderPersonChecklistCardModern(housing, personKey, label) {
    const person = housing[personKey];

    return `
        <div class="border border-slate-200 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between gap-4">
            <div>
                <!-- Encabezado de Persona -->
                <div class="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                    <div>
                        <span class="text-[10px] font-black uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">${label}</span>
                        <h4 class="text-base font-black uppercase mt-1.5 text-slate-900 tracking-tight">${person.name}</h4>
                    </div>
                    <div>${renderStatusBadge(person.status)}</div>
                </div>

                <!-- Botones de Acción -->
                <div class="flex gap-2 mb-4">
                    <button onclick="confirmPersonCompleted('${housing.id}', '${personKey}')" class="mockup-button bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-2 px-3 rounded-md uppercase flex-1 shadow-sm transition">
                        ✓ Confirmar Atendido
                    </button>
                    <button onclick="toggleRescheduleBox('${housing.id}', '${personKey}', true)" class="mockup-button bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold py-2 px-3 rounded-md uppercase flex-1 shadow-sm transition">
                        ↻ Reagendar
                    </button>
                </div>

                <!-- Formulario desplegable para reagendar -->
                <div id="rescheduleBox-${personKey}" class="hidden flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs mb-4">
                    <label class="font-bold uppercase text-[10px] text-slate-700">Motivo del Reagendado:</label>
                    <input type="text" id="rescheduleReasonInput-${personKey}" value="${person.rescheduleReason}" placeholder="Ej. Persona no localizada..." class="p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none">
                    <div class="flex justify-end gap-2 mt-1">
                        <button onclick="toggleRescheduleBox('${housing.id}', '${personKey}', false)" class="px-3 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold uppercase hover:bg-slate-100">Cancelar</button>
                        <button onclick="saveRescheduleReason('${housing.id}', '${personKey}')" class="px-3 py-1 bg-slate-900 text-white rounded text-[10px] font-bold uppercase hover:bg-slate-800">Guardar</button>
                    </div>
                </div>

                <!-- Opciones de Checklist -->
                <div class="border-t border-slate-100 pt-3 space-y-2.5 text-xs font-semibold text-slate-800">
                    <span class="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Procedimientos Médicos:</span>
                    <label class="flex items-center gap-2.5 cursor-pointer hover:text-sky-700 transition">
                        <input type="checkbox" ${person.checklist.vitalSigns ? 'checked' : ''} onchange="toggleChecklistItem('${housing.id}', '${personKey}', 'vitalSigns', this.checked)" class="w-4 h-4 rounded accent-sky-600">
                        <span>Signos vitales</span>
                    </label>
                    <label class="flex items-center gap-2.5 cursor-pointer hover:text-sky-700 transition">
                        <input type="checkbox" ${person.checklist.hemoglobin ? 'checked' : ''} onchange="toggleChecklistItem('${housing.id}', '${personKey}', 'hemoglobin', this.checked)" class="w-4 h-4 rounded accent-sky-600">
                        <span>Hemoglobina</span>
                    </label>
                    <label class="flex items-center gap-2.5 cursor-pointer hover:text-sky-700 transition">
                        <input type="checkbox" ${person.checklist.glucose ? 'checked' : ''} onchange="toggleChecklistItem('${housing.id}', '${personKey}', 'glucose', this.checked)" class="w-4 h-4 rounded accent-sky-600">
                        <span>Glucosa</span>
                    </label>
                    <label class="flex items-center gap-2.5 cursor-pointer hover:text-sky-700 transition">
                        <input type="checkbox" ${person.checklist.urineSample ? 'checked' : ''} onchange="toggleChecklistItem('${housing.id}', '${personKey}', 'urineSample', this.checked)" class="w-4 h-4 rounded accent-sky-600">
                        <span>Muestra de orina</span>
                    </label>
                </div>
            </div>

            <!-- Resumen de Muestras Pendientes -->
            <div class="border-t border-dashed border-slate-200 pt-3 bg-slate-50/80 p-3 rounded-lg text-xs">
                <strong class="uppercase text-[10px] block font-black text-slate-500 mb-0.5">Estado de Pendientes:</strong>
                ${renderPendingSummary(person)}
            </div>
        </div>
    `;
}

function renderPriorityPendingList() {
    const container = document.getElementById('priorityPendingList');
    const badgeCount = document.getElementById('priorityBadgeCount');
    if (!container || !badgeCount) return;

    container.innerHTML = '';
    let totalPendingPersons = 0;

    housingVisits.forEach(h => {
        ['personA', 'personB'].forEach((key, idx) => {
            const person = h[key];
            if (person.status !== 'completed' && person.pendingItems && person.pendingItems.length > 0) {
                totalPendingPersons++;
                const itemCard = document.createElement('div');
                itemCard.className = "bg-white border-2 border-amber-800 p-3 flex flex-col justify-between gap-2 rounded-lg";
                itemCard.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start border-b border-amber-800 pb-1 mb-1">
                            <div>
                                <span class="text-[10px] font-black uppercase text-amber-900">Vivienda #${h.id} (${h.colonia})</span>
                                <h4 class="text-xs font-black uppercase text-slate-900">${person.name}</h4>
                            </div>
                            <span class="text-[9px] font-black uppercase bg-amber-800 text-white px-1.5 py-0.5 rounded">${idx === 0 ? 'Persona A' : 'Persona B'}</span>
                        </div>
                        <p class="text-[11px] text-slate-700"><strong>Domicilio:</strong> ${h.address}</p>
                        <div class="mt-2">
                            <span class="text-[10px] font-bold uppercase text-amber-900 block">Muestras Faltantes:</span>
                            <ul class="list-disc list-inside text-[11px] font-semibold text-rose-800">
                                ${person.pendingItems.map(p => `<li>${p}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    <button onclick="openChecklistForPerson('${h.id}')" class="mockup-button bg-amber-800 text-white text-[10px] font-bold py-1 uppercase w-full mt-1 rounded">
                        Tomar Muestras Ahora
                    </button>
                `;
                container.appendChild(itemCard);
            }
        });
    });

    badgeCount.innerText = `${totalPendingPersons} Pendientes`;

    if (totalPendingPersons === 0) {
        container.innerHTML = `<div class="col-span-2 bg-white p-4 border border-amber-800 text-center text-xs font-bold text-emerald-800 uppercase rounded-lg">¡Excelente! No hay muestras pendientes en este momento.</div>`;
    }
}

function openChecklistForPerson(housingId) {
    selectedHousingForChecklist = housingId;
    switchView('view-checklists');

    // Seleccionar automáticamente la colonia y la vivienda correspondientes
    const housing = housingVisits.find(h => h.id === housingId);
    if (housing) {
        const selectColonia = document.getElementById('selectColoniaChecklist');
        if (selectColonia) {
            selectColonia.value = housing.colonia;
            filterChecklistViviendasByColonia(housing.colonia);
        }
        const selectHousing = document.getElementById('selectHousingDetail');
        if (selectHousing) selectHousing.value = housingId;
    }
}

function toggleChecklistItem(housingId, personKey, itemKey, isChecked) {
    const housing = housingVisits.find(h => h.id === housingId);
    if (!housing) return;

    housing[personKey].checklist[itemKey] = isChecked;
    housing.synced = false;
    updatePersonPendingStatus(housing[personKey]);

    saveVisitsToLocalStorage();
    if (navigator.onLine && supabaseClient) syncSingleVisitToSupabase(housing);

    renderHousingChecklistDetail(housingId);
    renderPriorityPendingList();
}

function updatePersonPendingStatus(person) {
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

function renderPendingSummary(person) {
    if (person.status === 'rescheduled') {
        return `<span class="italic text-rose-800 font-bold">Persona reagendada. Razón: "${person.rescheduleReason || 'Sin especificar'}"</span>`;
    }
    if (!person.pendingItems || person.pendingItems.length === 0) {
        return `<span class="text-emerald-800 font-black">✓ Todos los procedimientos completados.</span>`;
    }
    return `<ul class="list-disc list-inside font-semibold text-rose-800 mt-1">${person.pendingItems.map(i => `<li>${i}</li>`).join('')}</ul>`;
}

function confirmPersonCompleted(housingId, personKey) {
    const housing = housingVisits.find(h => h.id === housingId);
    if (!housing) return;

    Object.keys(housing[personKey].checklist).forEach(k => housing[personKey].checklist[k] = true);
    housing[personKey].status = 'completed';
    housing[personKey].pendingItems = [];
    housing.synced = false;

    saveVisitsToLocalStorage();
    if (navigator.onLine && supabaseClient) syncSingleVisitToSupabase(housing);

    renderHousingChecklistDetail(housingId);
    renderPriorityPendingList();
    showAlert(`¡Se completaron todos los procedimientos para ${housing[personKey].name}!`);
}

function toggleRescheduleBox(housingId, personKey, show) {
    const box = document.getElementById(`rescheduleBox-${personKey}`);
    if (box) {
        if (show) box.classList.remove('hidden');
        else box.classList.add('hidden');
    }
}

function saveRescheduleReason(housingId, personKey) {
    const housing = housingVisits.find(h => h.id === housingId);
    if (!housing) return;

    const input = document.getElementById(`rescheduleReasonInput-${personKey}`);
    const reason = input ? input.value.trim() : '';
    if (!reason) {
        alert("Por favor ingrese un motivo.");
        return;
    }

    housing[personKey].status = 'rescheduled';
    housing[personKey].rescheduleReason = reason;
    housing.synced = false;

    saveVisitsToLocalStorage();
    if (navigator.onLine && supabaseClient) syncSingleVisitToSupabase(housing);

    renderHousingChecklistDetail(housingId);
    renderPriorityPendingList();
    showAlert(`Estatus actualizado a Reagendado para ${housing[personKey].name}`);
}

/* ==========================================================
   EXPORTACIÓN A PDF CON RANGOS DE FECHA
   ========================================================== */
function openExportPdfModal() {
    const selectColonia = document.getElementById('pdfSelectColonia');
    if (!selectColonia) return;

    selectColonia.innerHTML = '';
    const colonias = [...new Set(housingVisits.map(v => v.colonia))].sort();
    colonias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.innerText = c.toUpperCase();
        selectColonia.appendChild(opt);
    });

    const modal = document.getElementById('exportPdfModal');
    if (modal) modal.classList.remove('hidden');
}

function closeExportPdfModal() {
    const modal = document.getElementById('exportPdfModal');
    if (modal) modal.classList.add('hidden');
}

function toggleCustomDateInputs(presetValue) {
    const container = document.getElementById('customDateInputs');
    if (!container) return;

    if (presetValue === 'custom') {
        container.classList.remove('hidden');
        container.classList.add('grid');
    } else {
        container.classList.add('hidden');
        container.classList.remove('grid');
    }
}

function handleGeneratePdf(event) {
    event.preventDefault();

    const coloniaSelected = document.getElementById('pdfSelectColonia').value;
    const datePreset = document.getElementById('pdfDatePreset').value;

    let filtered = housingVisits.filter(v => v.colonia === coloniaSelected);

    if (datePreset === 'this_week') {
        const curr = new Date();
        const firstday = new Date(curr.setDate(curr.getDate() - curr.getDay()));
        const lastday = new Date(curr.setDate(curr.getDate() - curr.getDay() + 6));

        filtered = filtered.filter(v => {
            const vDate = new Date(v.date);
            return vDate >= firstday && vDate <= lastday;
        });
    } else if (datePreset === 'custom') {
        const start = document.getElementById('pdfStartDate').value;
        const end = document.getElementById('pdfEndDate').value;

        if (start && end) {
            filtered = filtered.filter(v => v.date >= start && v.date <= end);
        }
    }

    if (filtered.length === 0) {
        alert("No hay registros que coincidan con los criterios de colonia y rango de fecha seleccionados.");
        return;
    }

    const printContainer = document.getElementById('pdfPrintTemplate');
    if (!printContainer) return;

    printContainer.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif; color: #000;">
            <div style="border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">AGENDA REFLECT - HOJA DE RUTA EN CAMPO</h1>
                <p style="font-size: 11px; margin-top: 4px; text-transform: uppercase; color: #333;">
                    <strong>Colonia:</strong> ${coloniaSelected.toUpperCase()} | <strong>Total de Casas a Visitar:</strong> ${filtered.length}
                </p>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                <thead>
                    <tr style="background-color: #0f172a; color: #fff; text-transform: uppercase;">
                        <th style="padding: 6px; border: 1px solid #000;">ID / Casa</th>
                        <th style="padding: 6px; border: 1px solid #000;">Fecha y Hora</th>
                        <th style="padding: 6px; border: 1px solid #000;">Domicilio</th>
                        <th style="padding: 6px; border: 1px solid #000;">Personas A y B</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(item => `
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 6px; border: 1px solid #000; font-weight: bold;">#${item.id}</td>
                            <td style="padding: 6px; border: 1px solid #000;">${item.date}<br>${item.time} hrs</td>
                            <td style="padding: 6px; border: 1px solid #000;">${item.address}</td>
                            <td style="padding: 6px; border: 1px solid #000;">
                                1. ${item.personA.name}<br>
                                2. ${item.personB.name}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    closeExportPdfModal();

    if (typeof html2pdf !== 'undefined') {
        const opt = {
            margin:       0.5,
            filename:     `Ruta_Colonia_${coloniaSelected}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(printContainer).save();
    } else {
        window.print();
    }
}