// PyORB Main JavaScript - Phase 2
const API = '/api';
let token = localStorage.getItem('pyorb_token');
let currentUser = JSON.parse(localStorage.getItem('pyorb_user') || 'null');

// ─── Auth ───────────────────────────────────────────────
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('login-error');
    errorDiv.style.display = 'none';

    if (!username || !password) {
        errorDiv.textContent = 'Please enter username and password';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        const res = await fetch(`${API}/auth/token`, { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) {
            errorDiv.textContent = data.detail || 'Login failed';
            errorDiv.style.display = 'block';
            return;
        }

        token = data.access_token;
        currentUser = data.user;
        localStorage.setItem('pyorb_token', token);
        localStorage.setItem('pyorb_user', JSON.stringify(currentUser));
        showApp();
    } catch (e) {
        errorDiv.textContent = 'Connection error. Is the server running?';
        errorDiv.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('pyorb_token');
    localStorage.removeItem('pyorb_user');
    token = null; currentUser = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('nav-username').textContent = currentUser.full_name;
    document.getElementById('nav-role').textContent = currentUser.role.replace('_', ' ');
    loadVesselSummary();
    showSection('dashboard');
}

// ─── API Helper ─────────────────────────────────────────
async function apiCall(method, path, body = null) {
    const opts = {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}${path}`, opts);
    if (res.status === 401) { logout(); return null; }
    return res;
}

// ─── Navigation ─────────────────────────────────────────
function showSection(name) {
    ['dashboard', 'vessel', 'users', 'tanks'].forEach(s => {
        document.getElementById(`section-${s}`).style.display = s === name ? 'block' : 'none';
    });
    if (name === 'vessel') loadVesselForm();
    if (name === 'users') loadUsers();
    if (name === 'tanks') loadTanks();
}

// ─── Vessel ─────────────────────────────────────────────
async function loadVesselSummary() {
    const res = await apiCall('GET', '/vessel/');
    if (!res || !res.ok) return;
    const v = await res.json();
    document.getElementById('vessel-summary').innerHTML = `
        <span><strong>${v.name}</strong>Vessel Name</span>
        <span><strong>IMO ${v.imo_number}</strong>IMO Number</span>
        <span><strong>${v.flag_state}</strong>Flag State</span>
        <span><strong>${v.vessel_type.replace('_',' ')}</strong>Type</span>
        <span><strong>ORB ${v.orb_mode.replace('_',' ').toUpperCase()}</strong>Mode</span>
    `;
}

async function loadVesselForm() {
    const container = document.getElementById('vessel-form-container');
    const res = await apiCall('GET', '/vessel/');
    let vessel = null;
    if (res && res.ok) vessel = await res.json();

    container.innerHTML = `
        <div class="table-wrap" style="padding:1.5rem; max-width:600px">
            <h2 style="margin-bottom:1rem;color:var(--primary)">${vessel ? 'Edit' : 'Configure'} Vessel</h2>
            <div class="form-group"><label>Vessel Name *</label><input id="v-name" value="${vessel?.name||''}"></div>
            <div class="form-group"><label>IMO Number *</label><input id="v-imo" value="${vessel?.imo_number||''}"></div>
            <div class="form-group"><label>MMSI</label><input id="v-mmsi" value="${vessel?.mmsi||''}"></div>
            <div class="form-group"><label>Call Sign</label><input id="v-call" value="${vessel?.call_sign||''}"></div>
            <div class="form-group"><label>Flag State *</label><input id="v-flag" value="${vessel?.flag_state||''}"></div>
            <div class="form-group"><label>Vessel Type *</label>
                <select id="v-type">
                    ${['oil_tanker','bulk_carrier','general_cargo','container','other'].map(t =>
                        `<option value="${t}" ${vessel?.vessel_type===t?'selected':''}>${t.replace(/_/g,' ')}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group"><label>Gross Tonnage</label><input id="v-gt" value="${vessel?.gross_tonnage||''}"></div>
            <div class="form-group"><label>Deadweight</label><input id="v-dwt" value="${vessel?.deadweight||''}"></div>
            <div class="form-group"><label>Year Built</label><input id="v-year" value="${vessel?.year_built||''}"></div>
            <div class="form-group"><label>Owner</label><input id="v-owner" value="${vessel?.owner||''}"></div>
            <div class="form-group"><label>Operator</label><input id="v-oper" value="${vessel?.operator||''}"></div>
            <div class="form-group"><label>ORB Mode *</label>
                <select id="v-mode">
                    <option value="part1" ${vessel?.orb_mode==='part1'?'selected':''}>Part I - Machinery Space</option>
                    <option value="part2" ${vessel?.orb_mode==='part2'?'selected':''}>Part II - Cargo/Ballast</option>
                    <option value="both" ${vessel?.orb_mode==='both'?'selected':''}>Both Part I and Part II</option>
                </select>
            </div>
            <div id="vessel-msg"></div>
            <button class="btn" onclick="saveVessel('${vessel?.id||''}')">💾 Save Vessel</button>
        </div>
    `;
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
        orb_mode: document.getElementById('v-mode').value
    };
    const method = vesselId ? 'PUT' : 'POST';
    const path = vesselId ? `/vessel/${vesselId}` : '/vessel/';
    const res = await apiCall(method, path, data);
    const msg = document.getElementById('vessel-msg');
    if (res && res.ok) {
        msg.innerHTML = '<div class="alert alert-success">✅ Vessel saved successfully</div>';
        loadVesselSummary();
    } else {
        const err = await res?.json();
        msg.innerHTML = `<div class="alert alert-error">❌ ${err?.detail || 'Save failed'}</div>`;
    }
}

// ─── Users ──────────────────────────────────────────────
async function loadUsers() {
    const res = await apiCall('GET', '/users/');
    if (!res || !res.ok) return;
    const users = await res.json();
    document.getElementById('users-list').innerHTML = `
        <div class="table-wrap">
            <table>
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Rank</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>${users.map(u => `
                    <tr>
                        <td>${u.full_name}</td>
                        <td>${u.username}</td>
                        <td><span class="role-badge" style="background:#e8f4fd;color:var(--accent);padding:0.2rem 0.5rem;border-radius:4px">${u.role.replace(/_/g,' ')}</span></td>
                        <td>${u.rank||'-'}</td>
                        <td>${u.is_active ? '✅ Active' : '🔴 Inactive'}</td>
                        <td><button class="btn btn-sm" onclick="editUser('${u.id}')">Edit</button></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function showAddUser() {
    showUserModal(null);
}

function showUserModal(user) {
    const roles = ['admin','chief_engineer','second_engineer','third_engineer','officer','master','shore_office','port_authority','viewer'];
    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="user-modal">
            <div class="modal">
                <h2>${user ? 'Edit User' : 'Add User'}</h2>
                <div class="form-group"><label>Full Name *</label><input id="u-name" value="${user?.full_name||''}"></div>
                <div class="form-group"><label>Username *</label><input id="u-username" value="${user?.username||''}" ${user?'disabled':''}></div>
                ${!user ? '<div class="form-group"><label>Password *</label><input type="password" id="u-password"></div>' : ''}
                <div class="form-group"><label>Role *</label>
                    <select id="u-role">${roles.map(r => `<option value="${r}" ${user?.role===r?'selected':''}>${r.replace(/_/g,' ')}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Rank</label><input id="u-rank" value="${user?.rank||''}"></div>
                <div class="form-group"><label>Email</label><input id="u-email" value="${user?.email||''}"></div>
                <div class="form-group"><label>Certificate No.</label><input id="u-cert" value="${user?.certificate_number||''}"></div>
                <div id="user-modal-msg"></div>
                <div class="modal-actions">
                    <button class="btn btn-outline" style="background:#666;color:white" onclick="closeModal('user-modal')">Cancel</button>
                    <button class="btn" onclick="saveUser('${user?.id||''}')">💾 Save</button>
                </div>
            </div>
        </div>
    `);
}

async function editUser(userId) {
    const res = await apiCall('GET', '/users/');
    if (!res || !res.ok) return;
    const users = await res.json();
    const user = users.find(u => u.id === userId);
    if (user) showUserModal(user);
}

async function saveUser(userId) {
    const data = {
        full_name: document.getElementById('u-name').value,
        role: document.getElementById('u-role').value,
        rank: document.getElementById('u-rank').value || null,
        email: document.getElementById('u-email').value || null,
        certificate_number: document.getElementById('u-cert').value || null,
    };
    let res;
    if (userId) {
        res = await apiCall('PUT', `/users/${userId}`, data);
    } else {
        data.username = document.getElementById('u-username').value;
        data.password = document.getElementById('u-password').value;
        res = await apiCall('POST', '/users/', data);
    }
    const msg = document.getElementById('user-modal-msg');
    if (res && res.ok) {
        closeModal('user-modal');
        loadUsers();
    } else {
        const err = await res?.json();
        msg.innerHTML = `<div class="alert alert-error">❌ ${err?.detail || 'Save failed'}</div>`;
    }
}

// ─── Tanks ──────────────────────────────────────────────
async function loadTanks() {
    const res = await apiCall('GET', '/tanks/');
    if (!res || !res.ok) return;
    const tanks = await res.json();
    document.getElementById('tanks-list').innerHTML = `
        <div class="table-wrap">
            <table>
                <thead><tr><th>Tank Name</th><th>Type</th><th>Capacity (m³)</th><th>Position</th><th>Frames</th><th>Ext. ID</th><th>Actions</th></tr></thead>
                <tbody>${tanks.map(t => `
                    <tr>
                        <td><strong>${t.name}</strong></td>
                        <td>${t.tank_type.replace(/_/g,' ')}</td>
                        <td>${t.capacity_m3.toFixed(2)}</td>
                        <td>${t.position||'-'}</td>
                        <td>${t.frame_from||'-'} — ${t.frame_to||'-'}</td>
                        <td>${t.external_system_id||'-'}</td>
                        <td><button class="btn btn-sm" onclick="deactivateTank('${t.id}','${t.name}')">Remove</button></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function showAddTank() {
    const vRes = await apiCall('GET', '/vessel/');
    if (!vRes || !vRes.ok) { alert('Please configure vessel first'); return; }
    const vessel = await vRes.json();
    const types = ['fuel_oil','diesel_oil','lubricating_oil','ballast','slop','bilge','cargo','fresh_water','other'];
    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="tank-modal">
            <div class="modal">
                <h2>Add Tank</h2>
                <div class="form-group"><label>Tank Name *</label><input id="t-name" placeholder="e.g. FO Tank P"></div>
                <div class="form-group"><label>Tank Type *</label>
                    <select id="t-type">${types.map(t => `<option value="${t}">${t.replace(/_/g,' ')}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Capacity (m³) *</label><input type="number" step="0.01" id="t-cap"></div>
                <div class="form-group"><label>Position</label>
                    <select id="t-pos"><option value="">-</option><option>port</option><option>starboard</option><option>center</option></select>
                </div>
                <div class="form-group"><label>Frame From</label><input id="t-ff" placeholder="e.g. 45"></div>
                <div class="form-group"><label>Frame To</label><input id="t-ft" placeholder="e.g. 60"></div>
                <div class="form-group"><label>External System ID</label><input id="t-ext" placeholder="Valmarine / Kongsberg / NAPA ID"></div>
                <div id="tank-modal-msg"></div>
                <div class="modal-actions">
                    <button class="btn btn-outline" style="background:#666;color:white" onclick="closeModal('tank-modal')">Cancel</button>
                    <button class="btn" onclick="saveTank('${vessel.id}')">💾 Save Tank</button>
                </div>
            </div>
        </div>
    `);
}

async function saveTank(vesselId) {
    const data = {
        vessel_id: vesselId,
        name: document.getElementById('t-name').value,
        tank_type: document.getElementById('t-type').value,
        capacity_m3: parseFloat(document.getElementById('t-cap').value),
        position: document.getElementById('t-pos').value || null,
        frame_from: document.getElementById('t-ff').value || null,
        frame_to: document.getElementById('t-ft').value || null,
        external_system_id: document.getElementById('t-ext').value || null,
    };
    const res = await apiCall('POST', '/tanks/', data);
    const msg = document.getElementById('tank-modal-msg');
    if (res && res.ok) {
        closeModal('tank-modal');
        loadTanks();
    } else {
        const err = await res?.json();
        msg.innerHTML = `<div class="alert alert-error">❌ ${err?.detail || 'Save failed'}</div>`;
    }
}

async function deactivateTank(tankId, tankName) {
    if (!confirm(`Remove tank "${tankName}"?`)) return;
    const res = await apiCall('DELETE', `/tanks/${tankId}`);
    if (res && res.ok) loadTanks();
}

// ─── Utilities ──────────────────────────────────────────
function closeModal(id) {
    document.getElementById(id)?.remove();
}

// Enter key on login
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') login();
});

// Auto login if token exists
if (token && currentUser) showApp();
