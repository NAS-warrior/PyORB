const API = '/api';
let token = localStorage.getItem('pyorb_token');
let currentUser = JSON.parse(localStorage.getItem('pyorb_user') || 'null');
let vesselData = null;
let tanksData = [];
let appInfo = null;
let selectedTank = null;
let selectedP1Code = null;
let selectedP2Code = null;

// ── Constants ─────────────────────────────────────────────────────────────────
const TANK_COLORS = {
    fuel_oil:'g-hfo', diesel_oil:'g-mgo', lubricating_oil:'g-lo',
    bilge:'g-bilge', slop:'g-slop', ballast:'g-ballast',
    cargo:'g-cargo', fresh_water:'g-fw', other:'g-other'
};
const TANK_LABELS = {
    fuel_oil:'Heavy Fuel Oil', diesel_oil:'Diesel / MGO', lubricating_oil:'Lubricating Oil',
    bilge:'Bilge', slop:'Slop', ballast:'Ballast', cargo:'Cargo',
    fresh_water:'Fresh Water', other:'Other'
};
const TYPE_ORDER = ['fuel_oil','diesel_oil','lubricating_oil','bilge','slop','ballast','cargo','fresh_water','other'];

const PART1_CODES = [
    {code:'A', label:'Ballasting of fuel oil tanks',    tanks:['fuel_oil','ballast'],                         desc:'Ballasting or cleaning of fuel oil tanks. State tank identity, position, quantity pumped in (m³).'},
    {code:'B', label:'Cleaning of fuel oil tanks',      tanks:['fuel_oil'],                                   desc:'Cleaning of fuel oil tanks. State tank identity and method of cleaning.'},
    {code:'C', label:'Discharge of dirty ballast',      tanks:['fuel_oil','ballast','slop'],                  desc:'Discharge of dirty ballast or cleaning water. State method, quantity discharged (m³).'},
    {code:'D', label:'Cleaning of bilge water',         tanks:['bilge'],                                      desc:'Cleaning of bilge holding tanks. State quantity, position, method used.'},
    {code:'E', label:'Discharge of bilge water',        tanks:['bilge','slop'],                               desc:'Discharge overboard or to reception facility. State position, OWS rate, PPM reading, quantity.'},
    {code:'F', label:'Condition of OWS / ODM',          tanks:[],                                             desc:'Condition of oil filtering equipment. State any malfunction or repairs to OWS/ODM.'},
    {code:'G', label:'Accidental / other discharge',    tanks:['__any__'],                                    desc:'Accidental or exceptional discharge. State time, position, quantity, circumstances, action taken.'},
    {code:'H', label:'Bunkering of fuel / LO',          tanks:['fuel_oil','diesel_oil','lubricating_oil'],    desc:'Bunkering of fuel oil or bulk lubricating oil. State port, tank, grade, quantity (m³ and MT).'},
    {code:'I', label:'Additional procedures / remarks', tanks:['__any__'],                                    desc:'Any other operation required by MARPOL Annex I or general remarks.'},
];
const PART2_CODES = [
    {code:'A', label:'Loading of oil cargo',            tanks:['cargo'],                      desc:'Loading of oil cargo. State port, tank identity, type and quantity of cargo (m³).'},
    {code:'B', label:'Internal transfer of cargo',      tanks:['cargo'],                      desc:'Internal transfer during voyage. State from/to tanks and quantity transferred (m³).'},
    {code:'C', label:'Unloading of oil cargo',          tanks:['cargo'],                      desc:'Unloading of oil cargo. State port, tank, quantity discharged, quantity remaining.'},
    {code:'D', label:'Ballasting of cargo tanks',       tanks:['cargo','ballast'],            desc:'Ballasting of cargo tanks or CBT. State tank, position, quantity (m³).'},
    {code:'E', label:'Cleaning of cargo tanks',         tanks:['cargo'],                      desc:'Tank cleaning including COW. State tanks, method, quantity of cleaning water.'},
    {code:'F', label:'Discharge of ballast water',      tanks:['cargo','ballast','slop'],     desc:'Discharge of ballast or cleaning water. State position, quantity (m³), PPM at discharge.'},
    {code:'G', label:'Accidental / other discharge',    tanks:['__any__'],                    desc:'Accidental discharge. State time, position, quantity, type, circumstances, action.'},
];

// ── App Info & Mode ───────────────────────────────────────────────────────────
async function loadAppInfo() {
    try {
        const res = await fetch('/api/appinfo');
        if (res.ok) { appInfo = await res.json(); renderModeBar(); }
    } catch(e) {}
}

function renderModeBar() {
    if (!appInfo) return;
    const isShip = appInfo.mode === 'ship';
    const el = document.getElementById('topbar-mode-label');
    if (el) {
        el.textContent = appInfo.mode_label;
        el.style.background = isShip ? 'rgba(255,255,255,0.15)' : 'rgba(167,139,250,0.4)';
    }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function login() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    const err = document.getElementById('login-error');
    err.style.display = 'none';
    if (!u || !p) { err.textContent = 'Enter username and password'; err.style.display = 'block'; return; }
    try {
        const fd = new FormData();
        fd.append('username', u); fd.append('password', p);
        const res = await fetch(`${API}/auth/token`, {method:'POST', body:fd});
        const data = await res.json();
        if (!res.ok) { err.textContent = data.detail || 'Login failed'; err.style.display = 'block'; return; }
        token = data.access_token; currentUser = data.user;
        localStorage.setItem('pyorb_token', token);
        localStorage.setItem('pyorb_user', JSON.stringify(currentUser));
        await initApp();
    } catch(e) { err.textContent = 'Connection error'; err.style.display = 'block'; }
}

function logout() {
    localStorage.removeItem('pyorb_token'); localStorage.removeItem('pyorb_user');
    token = null; currentUser = null; vesselData = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

async function initApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('topbar-username').textContent = currentUser.full_name;
    document.getElementById('topbar-role').textContent = currentUser.role.replace(/_/g,' ');
    document.getElementById('topbar-avatar').textContent =
        currentUser.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    await loadAppInfo();
    await loadVessel();
    await loadTanks();
    switchTab('dashboard');
}

// ── API ───────────────────────────────────────────────────────────────────────
async function req(method, path, body=null) {
    const opts = {method, headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}};
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}${path}`, opts);
    if (res.status === 401) { logout(); return null; }
    return res;
}

// ── Data Loaders ──────────────────────────────────────────────────────────────
async function loadVessel() {
    const res = await req('GET', '/vessel/');
    if (res && res.ok) {
        vesselData = await res.json();
        document.getElementById('topbar-vesselname').textContent = vesselData.name;
        document.getElementById('topbar-vesselinfo').textContent =
            `IMO ${vesselData.imo_number} | Flag: ${vesselData.flag_state} | Call: ${vesselData.call_sign||'-'}`;
        document.getElementById('topbar-mode').textContent = vesselData.orb_mode_label;
    } else {
        document.getElementById('topbar-vesselname').textContent = 'Vessel not configured';
        document.getElementById('topbar-mode').textContent = '';
    }
}

async function loadTanks() {
    const res = await req('GET', '/tanks/');
    if (res && res.ok) tanksData = await res.json();
}

// ── Tab Navigation ────────────────────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.maintab').forEach(t => t.classList.remove('active'));
    const tc = document.getElementById(`tab-${name}`);
    if (tc) { tc.style.display = 'block'; tc.classList.add('active'); }
    document.querySelector(`.maintab[data-tab="${name}"]`)?.classList.add('active');
    if (name === 'dashboard')  loadDashboard();
    if (name === 'operations') loadOperations();
    if (name === 'setup')      { showSetupSection('vessel'); }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
    renderTankGauges('dash-tanks', tanksData, false);
    await loadRecentEntries();
}

async function loadRecentEntries() {
    const limit = document.getElementById('recent-limit')?.value || 10;
    // Phase 3: fetch from /api/orb/entries?limit=N
    document.getElementById('recent-entries').innerHTML =
        `<tr><td colspan="6" class="empty-row">No entries yet — use Operations tab to record</td></tr>`;
}

// ── Tank Gauges ───────────────────────────────────────────────────────────────
function renderTankGauges(containerId, tanks, selectable=false) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const groups = {};
    TYPE_ORDER.forEach(t => groups[t] = []);
    tanks.forEach(t => { const k = t.tank_type in groups ? t.tank_type : 'other'; groups[k].push(t); });
    let html = '';
    TYPE_ORDER.forEach(type => {
        const grp = groups[type];
        if (!grp.length) return;
        const cap = grp.reduce((s,t) => s+t.capacity_m3, 0);
        html += `<div class="tank-group-label">${TANK_LABELS[type]||type} — ${grp.length} tanks — ${cap.toFixed(0)} m³</div>`;
        html += `<div class="tank-grid">`;
        grp.forEach(t => {
            const pct = Math.floor(Math.random()*70+20);
            const vol = (t.capacity_m3*pct/100).toFixed(1);
            const cls = TANK_COLORS[t.tank_type]||'g-other';
            const sel = selectable ? `onclick="selectTank('${t.id}','${t.name}','${t.tank_type}',${t.capacity_m3})"` : '';
            const isSel = selectedTank?.id === t.id ? 'selected' : '';
            html += `<div class="tank-card ${isSel}" id="tc-${t.id}" ${sel}>
                <div class="tank-name">${t.name}</div>
                <div class="gauge-wrap">
                    <div class="gauge-bar"><div class="gauge-fill ${cls}" style="height:${pct}%"></div></div>
                    <div class="gauge-pct">${pct}%</div>
                    <div class="gauge-vol">${vol} m³</div>
                </div>
            </div>`;
        });
        html += `</div>`;
    });
    el.innerHTML = html || '<p style="color:#aaa;padding:10px">No tanks configured</p>';
}

// ── Operations ────────────────────────────────────────────────────────────────
async function loadOperations() {
    if (!vesselData) await loadVessel();
    if (!tanksData.length) await loadTanks();
    renderOpsLeftTanks();
    // Reset form panel
    document.getElementById('ops-form-panel').innerHTML = `
        <div class="ops-form-placeholder">
            <div class="placeholder-icon">&#128203;</div>
            <p>Select a tank on the left to begin recording an operation</p>
        </div>`;
    selectedTank = null; selectedP1Code = null; selectedP2Code = null;
}

function renderOpsLeftTanks() {
    const filter = document.getElementById('ops-tank-filter')?.value || '';
    const filtered = filter ? tanksData.filter(t => t.tank_type === filter) : tanksData;
    renderTankGauges('ops-tanks-panel', filtered, true);
}
function filterOpsTanks() { renderOpsLeftTanks(); }

function selectTank(id, name, type, capacity) {
    selectedTank = {id, name, type, capacity};
    selectedP1Code = null; selectedP2Code = null;

    // Highlight selected tank
    document.querySelectorAll('.tank-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`tc-${id}`)?.classList.add('selected');

    // Determine valid codes
    const validP1 = PART1_CODES.filter(c =>
        c.tanks.includes(type) || c.tanks.includes('__any__') || c.tanks.length === 0
    );
    const validP2 = vesselData?.requires_part2
        ? PART2_CODES.filter(c => c.tanks.includes(type) || c.tanks.includes('__any__'))
        : [];

    const typeLbl = TANK_LABELS[type] || type;
    const now = new Date();
    const local = new Date(now - now.getTimezoneOffset()*60000).toISOString().slice(0,16);

    let html = `<div class="ops-panel">
        <div class="ops-panel-header">
            <div>
                <div>Record ORB Operation</div>
                <div class="ops-panel-vessel">${vesselData?.name || ''} — ${vesselData?.orb_mode_label || ''}</div>
            </div>
        </div>
        <div class="ops-panel-body">
            <div class="selected-tank-bar">
                <div class="gauge-bar" style="width:12px;height:30px;flex-shrink:0">
                    <div class="gauge-fill ${TANK_COLORS[type]||'g-other'}" style="height:60%"></div>
                </div>
                <div>
                    <div class="selected-tank-name">${name}</div>
                    <div class="selected-tank-type">${typeLbl} — ${capacity.toFixed(0)} m³ capacity</div>
                </div>
            </div>`;

    // Part I codes
    html += `<div class="op-codes-label">ORB Part I — Select Operation Code</div>
        <div class="op-codes" id="p1-code-list">
        ${PART1_CODES.map(c => {
            const valid = c.tanks.includes(type) || c.tanks.includes('__any__') || c.tanks.length === 0;
            return `<div class="op-code ${valid?'':'op-code-disabled'}" id="p1c-${c.code}"
                data-code="${c.code}" onclick="${valid?`pickCode('part1','${c.code}')`:''}"
                title="${valid?'':'Not applicable for '+typeLbl+' tanks'}">
                <span class="op-code-badge">${c.code}</span>
                <span class="op-code-label">${c.label}</span>
            </div>`;
        }).join('')}
        </div>`;

    // Part II codes (tankers only)
    if (vesselData?.requires_part2) {
        html += `<div class="op-codes-label" style="margin-top:14px">ORB Part II — Cargo/Ballast Operations</div>
            <div class="op-codes" id="p2-code-list">
            ${PART2_CODES.map(c => {
                const valid = c.tanks.includes(type) || c.tanks.includes('__any__');
                return `<div class="op-code ${valid?'':'op-code-disabled'}" id="p2c-${c.code}"
                    data-code="${c.code}" onclick="${valid?`pickCode('part2','${c.code}')`:''}"
                    title="${valid?'':'Not applicable for '+typeLbl+' tanks'}">
                    <span class="op-code-badge">${c.code}</span>
                    <span class="op-code-label">${c.label}</span>
                </div>`;
            }).join('')}
            </div>`;
    }

    // Entry form (initially hidden)
    html += `<div id="ops-entry-form" style="display:none">
        <div class="form-divider"></div>
        <div id="ops-code-desc" class="code-desc"></div>
        <div class="form-row-2">
            <div class="form-group"><label>Operation Date &amp; Time *</label>
                <input type="datetime-local" id="op-date" value="${local}"></div>
            <div class="form-group"><label>Port (if in port)</label>
                <input type="text" id="op-port" placeholder="Port name"></div>
        </div>
        <div class="form-row-3">
            <div class="form-group"><label>Latitude</label>
                <input type="text" id="op-lat" placeholder="e.g. 35.6892 N"></div>
            <div class="form-group"><label>Longitude</label>
                <input type="text" id="op-lon" placeholder="e.g. 14.3754 E"></div>
            <div class="form-group"><label>Quantity (m³)</label>
                <input type="number" step="0.01" id="op-qty" placeholder="0.00"></div>
        </div>
        <div id="ppm-row" class="form-row-2" style="display:none">
            <div class="form-group"><label>OWS Rate (m³/h)</label>
                <input type="number" step="0.1" id="op-ows" placeholder="0.0"></div>
            <div class="form-group"><label>Oil Content (PPM)</label>
                <input type="number" step="0.1" id="op-ppm" placeholder="ODM reading"></div>
        </div>
        <div id="cargo-row" class="form-group" style="display:none">
            <label>Cargo Type</label>
            <input type="text" id="op-cargo" placeholder="e.g. Crude Oil, VLSFO">
        </div>
        <div class="form-group"><label>Remarks</label>
            <textarea id="op-remarks" rows="2" placeholder="Additional details, references, circumstances..."></textarea>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="clearOpsForm()">Clear</button>
            <button class="btn btn-primary" onclick="submitOpsEntry()">&#10003; Submit ORB Entry</button>
        </div>
    </div>

        </div><!-- ops-panel-body -->
    </div><!-- ops-panel -->`;

    document.getElementById('ops-form-panel').innerHTML = html;
}

function pickCode(part, code) {
    const codes = part === 'part1' ? PART1_CODES : PART2_CODES;
    const found = codes.find(c => c.code === code);
    if (!found) return;

    // Deactivate all codes in both lists
    document.querySelectorAll('.op-code').forEach(el => el.classList.remove('active'));
    document.getElementById(`${part === 'part1' ? 'p1c' : 'p2c'}-${code}`)?.classList.add('active');

    if (part === 'part1') selectedP1Code = code;
    else selectedP2Code = code;

    // Update desc
    document.getElementById('ops-code-desc').textContent =
        `Code ${code} — ${found.label}: ${found.desc}`;

    // Show/hide special fields
    const showPPM = part === 'part1' && (code === 'E' || code === 'F');
    const showCargo = part === 'part2';
    document.getElementById('ppm-row').style.display = showPPM ? 'grid' : 'none';
    document.getElementById('cargo-row').style.display = showCargo ? 'block' : 'none';

    // Show form
    document.getElementById('ops-entry-form').style.display = 'block';
}

function clearOpsForm() {
    ['op-port','op-lat','op-lon','op-qty','op-ows','op-ppm','op-cargo','op-remarks'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.querySelectorAll('.op-code').forEach(el => el.classList.remove('active'));
    document.getElementById('ops-entry-form').style.display = 'none';
    document.getElementById('ops-code-desc').textContent = '';
    selectedP1Code = null; selectedP2Code = null;
}

async function submitOpsEntry() {
    const code = selectedP1Code || selectedP2Code;
    const part = selectedP1Code ? 'Part I' : 'Part II';
    if (!code) { alert('Please select an operation code'); return; }
    const date = document.getElementById('op-date').value;
    if (!date) { alert('Please enter operation date'); return; }
    // Phase 3: POST to API
    alert(`ORB ${part} entry ready:\nCode: ${code}\nTank: ${selectedTank.name}\nDate: ${date}\n\nFull submission enabled in Phase 3.`);
}

// ── Setup Sections ────────────────────────────────────────────────────────────
function showSetupSection(name) {
    ['vessel','users','tanks','system','audit'].forEach(s => {
        const el = document.getElementById(`setup-${s}`);
        if (el) el.style.display = s === name ? 'block' : 'none';
    });
    document.querySelectorAll('.setup-nav-item').forEach(el => el.classList.remove('active'));
    const idx = {vessel:0, users:1, tanks:2, system:3, audit:4}[name] ?? 0;
    document.querySelectorAll('.setup-nav-item')[idx]?.classList.add('active');
    if (name === 'vessel') loadSetupVessel();
    if (name === 'users')  loadSetupUsers();
    if (name === 'tanks')  loadSetupTanks();
    if (name === 'system') loadSetupSystem();
    if (name === 'audit')  loadSetupAudit();
}

// ── Setup: Vessel ─────────────────────────────────────────────────────────────
async function loadSetupVessel() {
    const res = await req('GET', '/vessel/');
    let v = null; if (res && res.ok) v = await res.json();
    const isAdmin = currentUser.role === 'admin';
    const dis = isAdmin ? '' : 'disabled';
    const types = [
        ['passenger','Passenger Ship'],['bulk_carrier','Bulk Carrier'],
        ['general_cargo','General Cargo'],['container','Container Ship'],
        ['oil_tanker','Oil Tanker'],['product_tanker','Product Tanker'],
        ['chemical_tanker','Chemical Tanker'],['oil_barge','Oil Barge'],['other','Other'],
    ];
    document.getElementById('setup-vessel').innerHTML = `
        <div class="form-card">
            <div class="form-card-header">
                <h2>Vessel Particulars</h2>
                ${v ? '<span class="badge badge-green">Configured</span>' : '<span class="badge badge-orange">Not Configured</span>'}
            </div>
            ${v ? `<div class="alert alert-info" style="margin-bottom:14px">
                ORB Mode auto-assigned: <strong>${v.orb_mode_label}</strong>
                ${v.requires_part2?' — Part II required (tanker/barge)':' — Part I only (non-tanker)'}
            </div>` : ''}
            <div class="form-grid-2">
                <div class="form-group"><label>Vessel Name *</label><input id="v-name" value="${v?.name||''}" ${dis} placeholder="e.g. Marella Explorer 2"></div>
                <div class="form-group"><label>IMO Number *</label><input id="v-imo" value="${v?.imo_number||''}" ${v?'disabled':dis} placeholder="e.g. 9072446"></div>
                <div class="form-group"><label>MMSI</label><input id="v-mmsi" value="${v?.mmsi||''}" ${dis}></div>
                <div class="form-group"><label>Call Sign</label><input id="v-call" value="${v?.call_sign||''}" ${dis}></div>
                <div class="form-group"><label>Flag State *</label><input id="v-flag" value="${v?.flag_state||''}" ${dis}></div>
                <div class="form-group"><label>Vessel Type * (sets ORB mode)</label>
                    <select id="v-type" ${dis} onchange="updateOrbPreview(this.value)">
                        ${types.map(([val,lbl])=>`<option value="${val}" ${v?.vessel_type===val?'selected':''}>${lbl}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Gross Tonnage (GT)</label><input id="v-gt" value="${v?.gross_tonnage||''}" ${dis}></div>
                <div class="form-group"><label>Deadweight (T)</label><input id="v-dwt" value="${v?.deadweight||''}" ${dis}></div>
                <div class="form-group"><label>Year Built</label><input id="v-year" value="${v?.year_built||''}" ${dis}></div>
                <div class="form-group"><label>Owner</label><input id="v-owner" value="${v?.owner||''}" ${dis}></div>
                <div class="form-group"><label>Operator</label><input id="v-oper" value="${v?.operator||''}" ${dis}></div>
                <div class="form-group"><label>ORB Mode (auto-assigned)</label>
                    <input id="v-mode-disp" value="${v?.orb_mode_label||'Set by vessel type'}" disabled style="background:#f0f4f8;color:#555">
                </div>
            </div>
            <div id="vessel-msg"></div>
            ${isAdmin ? `<div class="form-actions-outer">
                <button class="btn btn-primary" onclick="saveVessel('${v?.id||''}')">Save Vessel</button>
            </div>` : '<p class="perm-note">Only Admin can edit vessel details.</p>'}
        </div>`;
}

function updateOrbPreview(type) {
    const tankers = ['oil_tanker','product_tanker','chemical_tanker','oil_barge'];
    const el = document.getElementById('v-mode-disp');
    if (el) el.value = tankers.includes(type)
        ? 'Part I + Part II — Tanker Operations'
        : 'Part I — Machinery Space Only';
}

async function saveVessel(vesselId) {
    const data = {
        name: document.getElementById('v-name').value,
        imo_number: document.getElementById('v-imo').value,
        mmsi: document.getElementById('v-mmsi').value || null,
        call_sign: document.getElementById('v-call').value || null,
        flag_state: document.getElementById('v-flag').value,
        vessel_type: document.getElementById('v-type').value,
        gross_tonnage: document.getElementById('v-gt').value || null,
        deadweight: document.getElementById('v-dwt').value || null,
        year_built: document.getElementById('v-year').value || null,
        owner: document.getElementById('v-owner').value || null,
        operator: document.getElementById('v-oper').value || null,
    };
    const res = await req(vesselId?'PUT':'POST', vesselId?`/vessel/${vesselId}`:'/vessel/', data);
    const msg = document.getElementById('vessel-msg');
    if (res && res.ok) {
        msg.innerHTML = '<div class="alert alert-success">Vessel saved successfully</div>';
        await loadVessel(); setTimeout(() => loadSetupVessel(), 800);
    } else {
        const err = await res?.json();
        msg.innerHTML = `<div class="alert alert-error">${err?.detail||'Save failed'}</div>`;
    }
}

// ── Setup: Users ──────────────────────────────────────────────────────────────
async function loadSetupUsers() {
    const res = await req('GET', '/users/');
    if (!res || !res.ok) return;
    const users = await res.json();
    const isAdmin = currentUser.role === 'admin';
    document.getElementById('setup-users').innerHTML = `
        <div class="form-card">
            <div class="section-actions">
                <h2>Users &amp; Crew (${users.length})</h2>
                ${isAdmin ? '<button class="btn btn-primary btn-sm" onclick="showUserModal(null)">+ Add User</button>' : ''}
            </div>
            <div style="overflow-x:auto">
                <table class="data-table">
                    <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Rank</th><th>Certificate</th><th>Status</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
                    <tbody>${users.map(u=>`<tr>
                        <td><strong>${u.full_name}</strong></td>
                        <td><code>${u.username}</code></td>
                        <td><span class="badge badge-blue">${u.role.replace(/_/g,' ')}</span></td>
                        <td>${u.rank||'-'}</td>
                        <td>${u.certificate_number||'-'}</td>
                        <td>${u.is_active?'<span class="badge badge-green">Active</span>':'<span class="badge badge-red">Inactive</span>'}</td>
                        ${isAdmin?`<td style="display:flex;gap:4px">
                            <button class="btn btn-sm btn-secondary" onclick='showUserModal(${JSON.stringify(u)})'>Edit</button>
                            <button class="btn btn-sm btn-secondary" onclick="showPwdModal('${u.id}','${u.username}')">Pwd</button>
                        </td>`:''}
                    </tr>`).join('')}</tbody>
                </table>
            </div>
        </div>`;
}

// ── Setup: Tanks ──────────────────────────────────────────────────────────────
async function loadSetupTanks() {
    const [tRes,vRes] = await Promise.all([req('GET','/tanks/'),req('GET','/vessel/')]);
    const tanks = tRes&&tRes.ok ? await tRes.json() : [];
    const vessel = vRes&&vRes.ok ? await vRes.json() : null;
    const isAdmin = currentUser.role === 'admin';
    const groups = {}; TYPE_ORDER.forEach(t=>groups[t]=[]);
    tanks.forEach(t=>{const k=t.tank_type in groups?t.tank_type:'other';groups[k].push(t);});
    let html = `<div class="form-card"><div class="section-actions">
        <h2>Tanks (${tanks.length} — ${Math.round(tanks.reduce((s,t)=>s+t.capacity_m3,0))} m³ total)</h2>
        ${isAdmin&&vessel?`<button class="btn btn-primary btn-sm" onclick="showTankModal('${vessel.id}')">+ Add Tank</button>`:''}
    </div>`;
    TYPE_ORDER.forEach(type=>{
        const grp=groups[type]; if(!grp.length)return;
        const cap=grp.reduce((s,t)=>s+t.capacity_m3,0);
        html+=`<div class="tank-group-label">${TANK_LABELS[type]||type} — ${grp.length} tanks — ${cap.toFixed(0)} m³</div>
        <div style="overflow-x:auto"><table class="data-table" style="margin-bottom:8px">
            <thead><tr><th>Tank Name</th><th>Capacity m³</th><th>Position</th><th>Frames</th><th>Ext. ID</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
            <tbody>${grp.map(t=>`<tr>
                <td><strong>${t.name}</strong></td><td>${t.capacity_m3.toFixed(2)}</td>
                <td>${t.position?`<span class="badge badge-grey">${t.position}</span>`:'-'}</td>
                <td>${t.frame_from||'-'} — ${t.frame_to||'-'}</td>
                <td><code>${t.external_system_id||'-'}</code></td>
                ${isAdmin?`<td><button class="btn btn-sm btn-danger" onclick="removeTank('${t.id}','${t.name}')">Remove</button></td>`:''}
            </tr>`).join('')}</tbody>
        </table></div>`;
    });
    html+='</div>';
    document.getElementById('setup-tanks').innerHTML=html;
}

// ── Setup: System & Mode ──────────────────────────────────────────────────────
async function loadSetupSystem() {
    const isAdmin = currentUser.role === 'admin';
    const [uRes,tRes] = await Promise.all([req('GET','/users/'),req('GET','/tanks/')]);
    const users = uRes&&uRes.ok ? await uRes.json() : [];
    const tanks = tRes&&tRes.ok ? await tRes.json() : [];
    const totalCap = tanks.reduce((s,t)=>s+t.capacity_m3,0);
    const modeIsShip = appInfo?.mode === 'ship';

    document.getElementById('setup-system').innerHTML = `
        <div class="form-card">
            <div class="form-card-header"><h2>System Information</h2></div>
            <div class="system-stats">
                <div class="stat-card"><div class="stat-val">${tanks.length}</div><div class="stat-lbl">Tanks</div></div>
                <div class="stat-card"><div class="stat-val">${Math.round(totalCap)}</div><div class="stat-lbl">Total Cap m³</div></div>
                <div class="stat-card"><div class="stat-val">${users.length}</div><div class="stat-lbl">Users</div></div>
                <div class="stat-card"><div class="stat-val">0</div><div class="stat-lbl">ORB Entries</div></div>
            </div>
            <div style="font-size:.8rem;color:#888;margin-bottom:16px">
                Version: ${appInfo?.app_version||'1.0.0'} &nbsp;|&nbsp;
                Active DB: ${modeIsShip?'DORB-Ship (pyorb_ship)':'DORB-Control (pyorb_control)'}
            </div>
        </div>

        <div class="form-card">
            <div class="form-card-header"><h2>Operational Mode</h2></div>
            <p style="color:#666;font-size:.85rem;margin-bottom:16px">
                DORB operates in one of two modes. Each mode uses its own separate database.
                Switching requires a valid license key for the target mode.
            </p>
            <div class="mode-cards">
                <div class="mode-card ${modeIsShip?'active-mode':''}">
                    <span class="badge ${modeIsShip?'badge-green':'badge-grey'} mode-active-badge">${modeIsShip?'Active':''}</span>
                    <h3>&#9875; DORB-Ship</h3>
                    <p>Single vessel onboard operation. Officers enter ORB records in real time.</p>
                    <p style="margin-top:8px;font-size:.75rem;color:#aaa">Database: pyorb_ship</p>
                </div>
                <div class="mode-card ${!modeIsShip?'active-mode':''}">
                    <span class="badge ${!modeIsShip?'badge-purple':'badge-grey'} mode-active-badge">${!modeIsShip?'Active':''}</span>
                    <h3>&#127760; DORB-Control</h3>
                    <p>Shore office fleet management. Read-only. Aggregates data from multiple vessels.</p>
                    <p style="margin-top:8px;font-size:.75rem;color:#aaa">Database: pyorb_control</p>
                </div>
            </div>
            ${isAdmin ? `<button class="btn btn-primary" onclick="showModeSwitcher()">
                Switch to ${modeIsShip?'DORB-Control':'DORB-Ship'}
            </button>` : '<p class="perm-note">Only Admin can switch modes.</p>'}
        </div>`;
}

// ── Setup: Audit ──────────────────────────────────────────────────────────────
async function loadSetupAudit() {
    document.getElementById('setup-audit').innerHTML = `
        <div class="form-card">
            <div class="form-card-header"><h2>Audit Log</h2></div>
            <table class="data-table">
                <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Table</th><th>Description</th></tr></thead>
                <tbody><tr><td colspan="5" class="empty-row">Audit log viewer coming in Phase 3 — all actions are recorded in the database.</td></tr></tbody>
            </table>
        </div>`;
}

// ── Mode Switching ────────────────────────────────────────────────────────────
function showModeSwitcher() {
    if (!appInfo) return;
    const isShip = appInfo.mode === 'ship';
    const target = isShip ? 'control' : 'ship';
    const label  = isShip ? 'DORB-Control' : 'DORB-Ship';
    const prefix = isShip ? 'CTRL-' : 'SHIP-';
    openModal(`<h2>Switch to ${label}</h2>
        <div class="alert alert-info" style="margin-bottom:14px">
            ${isShip
                ? 'Switching to DORB-Control connects to the fleet management database. For shore office use.'
                : 'Switching to DORB-Ship connects to the vessel onboard database.'}
            Each mode uses its own separate database. Current data is not affected.
        </div>
        <div class="form-group">
            <label>License Key for ${label} *</label>
            <input id="license-key" placeholder="${prefix}XXXX-XXXX-XXXX-XXXX" style="font-family:monospace">
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="confirmModeSwitch('${target}')">Activate ${label}</button>
        </div>`);
}

async function confirmModeSwitch(targetMode) {
    const key = document.getElementById('license-key').value.trim();
    if (!key) { showModalAlert('License key is required'); return; }
    const res = await req('POST', '/api/mode/switch', {target_mode:targetMode, license_key:key});
    if (res && res.ok) {
        closeModal();
        document.body.insertAdjacentHTML('beforeend', `
            <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);
                display:flex;align-items:center;justify-content:center;z-index:9999">
                <div style="background:#fff;border-radius:12px;padding:2rem;text-align:center;max-width:380px">
                    <div style="font-size:2.5rem;margin-bottom:1rem">&#10003;</div>
                    <h2 style="color:#1a3a5c;margin-bottom:.5rem">Mode Switched</h2>
                    <p style="color:#666">Reloading in 3 seconds...</p>
                </div>
            </div>`);
        setTimeout(() => window.location.reload(), 3000);
    } else {
        const err = await res?.json();
        showModalAlert(err?.detail || 'Mode switch failed');
    }
}

// ── User Modal ────────────────────────────────────────────────────────────────
function showUserModal(user) {
    const roles = ['admin','chief_engineer','second_engineer','third_engineer','officer','master','shore_office','port_authority','viewer'];
    const isEdit = !!user;
    openModal(`<h2>${isEdit?'Edit User':'Add User'}</h2>
        <div class="form-grid-2">
            <div class="form-group"><label>Full Name *</label><input id="u-name" value="${user?.full_name||''}" placeholder="Full name"></div>
            <div class="form-group"><label>Username *</label><input id="u-username" value="${user?.username||''}" ${isEdit?'disabled':''} placeholder="username"></div>
            ${!isEdit?'<div class="form-group"><label>Password *</label><input type="password" id="u-password" placeholder="Password"></div>':''}
            <div class="form-group"><label>Role *</label>
                <select id="u-role">${roles.map(r=>`<option value="${r}" ${user?.role===r?'selected':''}>${r.replace(/_/g,' ')}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Rank</label><input id="u-rank" value="${user?.rank||''}" placeholder="e.g. Chief Engineer"></div>
            <div class="form-group"><label>Email</label><input id="u-email" value="${user?.email||''}" placeholder="email@vessel.com"></div>
            <div class="form-group"><label>Certificate No.</label><input id="u-cert" value="${user?.certificate_number||''}" placeholder="Cert number"></div>
            ${isEdit?`<div class="form-group"><label>Status</label>
                <select id="u-active">
                    <option value="true" ${user?.is_active?'selected':''}>Active</option>
                    <option value="false" ${!user?.is_active?'selected':''}>Inactive</option>
                </select></div>`:''}
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveUser('${user?.id||''}')">Save</button>
        </div>`);
}

async function saveUser(userId) {
    const data = {
        full_name:document.getElementById('u-name').value,
        role:document.getElementById('u-role').value,
        rank:document.getElementById('u-rank').value||null,
        email:document.getElementById('u-email').value||null,
        certificate_number:document.getElementById('u-cert').value||null,
    };
    if (userId) { const a=document.getElementById('u-active'); if(a) data.is_active=a.value==='true'; }
    else { data.username=document.getElementById('u-username').value; data.password=document.getElementById('u-password').value; }
    const res = await req(userId?'PUT':'POST', userId?`/users/${userId}`:'/users/', data);
    if (res && res.ok) { closeModal(); loadSetupUsers(); }
    else { const err=await res?.json(); showModalAlert(err?.detail||'Failed'); }
}

function showPwdModal(userId, username) {
    openModal(`<h2>Change Password</h2>
        <p style="color:#888;margin-bottom:14px">User: <strong>${username}</strong></p>
        <div class="form-group"><label>New Password *</label><input type="password" id="new-pwd" placeholder="Min 6 characters"></div>
        <div class="form-group"><label>Confirm Password *</label><input type="password" id="conf-pwd" placeholder="Repeat password"></div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="savePwd('${userId}')">Change Password</button>
        </div>`);
}

async function savePwd(userId) {
    const p=document.getElementById('new-pwd').value;
    const c=document.getElementById('conf-pwd').value;
    if (p!==c) { showModalAlert('Passwords do not match'); return; }
    if (p.length<6) { showModalAlert('Minimum 6 characters'); return; }
    const res = await req('PUT', `/users/${userId}/password`, {new_password:p});
    if (res&&res.ok) { closeModal(); alert('Password changed successfully'); }
    else { const err=await res?.json(); showModalAlert(err?.detail||'Failed'); }
}

// ── Tank Modal ────────────────────────────────────────────────────────────────
function showTankModal(vesselId) {
    openModal(`<h2>Add Tank</h2>
        <div class="form-grid-2">
            <div class="form-group"><label>Tank Name *</label><input id="t-name" placeholder="e.g. HFO Tank Port FWD"></div>
            <div class="form-group"><label>Tank Type *</label>
                <select id="t-type">${TYPE_ORDER.map(t=>`<option value="${t}">${TANK_LABELS[t]||t}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Capacity (m³) *</label><input type="number" step="0.01" id="t-cap" placeholder="e.g. 850.00"></div>
            <div class="form-group"><label>Position</label>
                <select id="t-pos"><option value="">-</option><option value="port">Port</option><option value="starboard">Starboard</option><option value="center">Center</option></select>
            </div>
            <div class="form-group"><label>Frame From</label><input id="t-ff" placeholder="e.g. 20"></div>
            <div class="form-group"><label>Frame To</label><input id="t-ft" placeholder="e.g. 45"></div>
            <div class="form-group"><label>External System ID</label><input id="t-ext" placeholder="Valmarine / Kongsberg / NAPA ID"></div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveTank('${vesselId}')">Add Tank</button>
        </div>`);
}

async function saveTank(vesselId) {
    const data = {
        vessel_id:vesselId, name:document.getElementById('t-name').value,
        tank_type:document.getElementById('t-type').value,
        capacity_m3:parseFloat(document.getElementById('t-cap').value),
        position:document.getElementById('t-pos').value||null,
        frame_from:document.getElementById('t-ff').value||null,
        frame_to:document.getElementById('t-ft').value||null,
        external_system_id:document.getElementById('t-ext').value||null,
    };
    if (!data.name||!data.capacity_m3) { showModalAlert('Name and capacity required'); return; }
    const res = await req('POST', '/tanks/', data);
    if (res&&res.ok) { closeModal(); await loadTanks(); loadSetupTanks(); }
    else { const err=await res?.json(); showModalAlert(err?.detail||'Failed'); }
}

async function removeTank(id, name) {
    if (!confirm(`Remove tank "${name}"?`)) return;
    const res = await req('DELETE', `/tanks/${id}`);
    if (res&&res.ok) { await loadTanks(); loadSetupTanks(); }
}

// ── Modal Helpers ─────────────────────────────────────────────────────────────
function openModal(html) {
    closeModal();
    document.getElementById('modal-box').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
function handleOverlay(e) { if (e.target.id === 'modal-overlay') closeModal(); }
function showModalAlert(msg) {
    let a = document.getElementById('modal-alert');
    if (!a) { a=document.createElement('div'); a.id='modal-alert'; a.className='alert alert-error'; document.getElementById('modal-box').prepend(a); }
    a.textContent = msg;
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key==='Enter' && document.getElementById('login-screen')?.style.display!=='none') login();
    if (e.key==='Escape') closeModal();
});

loadAppInfo();
if (token && currentUser) initApp();
