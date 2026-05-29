// PyORB Main JavaScript - Full UI
const API = '/api';
let token = localStorage.getItem('pyorb_token');
let currentUser = JSON.parse(localStorage.getItem('pyorb_user') || 'null');

// ─── Auth ────────────────────────────────────────────────────────────────────
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('login-error');
    errorDiv.style.display = 'none';
    if (!username || !password) { showLoginError('Please enter username and password'); return; }
    try {
        const fd = new FormData();
        fd.append('username', username);
        fd.append('password', password);
        const res = await fetch(`${API}/auth/token`, { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { showLoginError(data.detail || 'Login failed'); return; }
        token = data.access_token;
        currentUser = data.user;
        localStorage.setItem('pyorb_token', token);
        localStorage.setItem('pyorb_user', JSON.stringify(currentUser));
        showApp();
    } catch(e) { showLoginError('Connection error. Is the server running?'); }
}

function showLoginError(msg) {
    const d = document.getElementById('login-error');
    d.textContent = msg; d.style.display = 'block';
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
    document.getElementById('nav-role').textContent = currentUser.role.replace(/_/g,' ');
    showSection('dashboard');
}

// ─── API Helper ──────────────────────────────────────────────────────────────
async function api(method, path, body=null) {
    const opts = { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }};
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}${path}`, opts);
    if (res.status === 401) { logout(); return null; }
    return res;
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function showSection(name) {
    ['dashboard','vessel','users','tanks'].forEach(s => {
        const el = document.getElementById(`section-${s}`);
        if (el) el.style.display = s === name ? 'block' : 'none';
    });
    // Set active nav link
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-links a[data-section="${name}"]`);
    if (activeLink) activeLink.classList.add('active');

    if (name === 'dashboard') loadDashboard();
    if (name === 'vessel')    loadVesselSection();
    if (name === 'users')     loadUsers();
    if (name === 'tanks')     loadTanks();
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
    // Load vessel summary
    const res = await api('GET', '/vessel/');
    const summary = document.getElementById('vessel-summary');
    if (res && res.ok) {
        const v = await res.json();
        summary.innerHTML = `
            <div class="vessel-info-grid">
                <div class="vinfo"><span class="vlabel">Vessel Name</span><span class="vvalue">${v.name}</span></div>
                <div class="vinfo"><span class="vlabel">IMO Number</span><span class="vvalue">${v.imo_number}</span></div>
                <div class="vinfo"><span class="vlabel">MMSI</span><span class="vvalue">${v.mmsi||'-'}</span></div>
                <div class="vinfo"><span class="vlabel">Call Sign</span><span class="vvalue">${v.call_sign||'-'}</span></div>
                <div class="vinfo"><span class="vlabel">Flag State</span><span class="vvalue">${v.flag_state}</span></div>
                <div class="vinfo"><span class="vlabel">Vessel Type</span><span class="vvalue">${v.vessel_type.replace(/_/g,' ')}</span></div>
                <div class="vinfo"><span class="vlabel">Gross Tonnage</span><span class="vvalue">${v.gross_tonnage||'-'} GT</span></div>
                <div class="vinfo"><span class="vlabel">Deadweight</span><span class="vvalue">${v.deadweight||'-'} T</span></div>
                <div class="vinfo"><span class="vlabel">Year Built</span><span class="vvalue">${v.year_built||'-'}</span></div>
                <div class="vinfo"><span class="vlabel">Owner</span><span class="vvalue">${v.owner||'-'}</span></div>
                <div class="vinfo"><span class="vlabel">Operator</span><span class="vvalue">${v.operator||'-'}</span></div>
                <div class="vinfo"><span class="vlabel">ORB Mode</span><span class="vvalue orb-mode">${v.orb_mode.replace(/_/g,' ').toUpperCase()}</span></div>
            </div>`;
    } else {
        summary.innerHTML = `<div class="no-vessel">No vessel configured. <a href="#" onclick="showSection('vessel')">Setup vessel</a></div>`;
    }

    // Load stats
    const [uRes, tRes] = await Promise.all([api('GET','/users/'), api('GET','/tanks/')]);
    const users = uRes && uRes.ok ? await uRes.json() : [];
    const tanks = tRes && tRes.ok ? await tRes.json() : [];

    // Group tanks by type
    const tankGroups = tanks.reduce((g, t) => { g[t.tank_type] = (g[t.tank_type]||0)+1; return g; }, {});
    const totalCap = tanks.reduce((s, t) => s + t.capacity_m3, 0);

    document.getElementById('dash-stats').innerHTML = `
        <div class="stat-card"><div class="stat-num">${users.length}</div><div class="stat-label">Users</div></div>
        <div class="stat-card"><div class="stat-num">${tanks.length}</div><div class="stat-label">Tanks</div></div>
        <div class="stat-card"><div class="stat-num">${totalCap.toFixed(0)}</div><div class="stat-label">Total Cap (m³)</div></div>
        <div class="stat-card"><div class="stat-num">0</div><div class="stat-label">ORB Entries</div></div>
    `;
}

// ─── Vessel ──────────────────────────────────────────────────────────────────
async function loadVesselSection() {
    const res = await api('GET', '/vessel/');
    let vessel = null;
    if (res && res.ok) vessel = await res.json();

    const isAdmin = currentUser.role === 'admin';
    const disabled = isAdmin ? '' : 'disabled';
    const vesselTypes = ['oil_tanker','bulk_carrier','general_cargo','container','other'];
    const orbModes = [['part1','Part I — Machinery Space'],['part2','Part II — Cargo/Ballast'],['both','Both Part I and Part II']];

    document.getElementById('vessel-form-container').innerHTML = `
        <div class="form-card">
            <div class="form-card-header">
                <h2>Vessel Particulars</h2>
                ${vessel ? `<span class="badge badge-green">Configured</span>` : `<span class="badge badge-orange">Not Configured</span>`}
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Vessel Name *</label><input id="v-name" value="${vessel?.name||''}" ${disabled} placeholder="e.g. Marella Explorer 2"></div>
                <div class="form-group"><label>IMO Number *</label><input id="v-imo" value="${vessel?.imo_number||''}" ${vessel?'disabled':''} placeholder="e.g. 9072446"></div>
                <div class="form-group"><label>MMSI</label><input id="v-mmsi" value="${vessel?.mmsi||''}" ${disabled} placeholder="e.g. 249054000"></div>
                <div class="form-group"><label>Call Sign</label><input id="v-call" value="${vessel?.call_sign||''}" ${disabled} placeholder="e.g. 9HJI9"></div>
                <div class="form-group"><label>Flag State *</label><input id="v-flag" value="${vessel?.flag_state||''}" ${disabled} placeholder="e.g. Malta"></div>
                <div class="form-group"><label>Vessel Type *</label>
                    <select id="v-type" ${disabled}>${vesselTypes.map(t=>`<option value="${t}" ${vessel?.vessel_type===t?'selected':''}>${t.replace(/_/g,' ')}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Gross Tonnage</label><input id="v-gt" value="${vessel?.gross_tonnage||''}" ${disabled} placeholder="e.g. 72458"></div>
                <div class="form-group"><label>Deadweight (T)</label><input id="v-dwt" value="${vessel?.deadweight||''}" ${disabled} placeholder="e.g. 7260"></div>
                <div class="form-group"><label>Year Built</label><input id="v-year" value="${vessel?.year_built||''}" ${disabled} placeholder="e.g. 1995"></div>
                <div class="form-group"><label>Owner</label><input id="v-owner" value="${vessel?.owner||''}" ${disabled} placeholder="e.g. TUI Group"></div>
                <div class="form-group"><label>Operator</label><input id="v-oper" value="${vessel?.operator||''}" ${disabled} placeholder="e.g. Marella Cruises"></div>
                <div class="form-group"><label>ORB Mode *</label>
                    <select id="v-mode" ${disabled}>${orbModes.map(([v,l])=>`<option value="${v}" ${vessel?.orb_mode===v?'selected':''}>${l}</option>`).join('')}</select>
                </div>
            </div>
            <div id="vessel-msg"></div>
            ${isAdmin ? `<div class="form-actions">
                <button class="btn btn-success" onclick="saveVessel('${vessel?.id||''}')">Save Vessel</button>
            </div>` : `<p class="perm-note">Only Admin can edit vessel details.</p>`}
        </div>`;
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
    const res = await api(vesselId ? 'PUT' : 'POST', vesselId ? `/vessel/${vesselId}` : '/vessel/', data);
    const msg = document.getElementById('vessel-msg');
    if (res && res.ok) {
        msg.innerHTML = '<div class="alert alert-success">Vessel saved successfully</div>';
        setTimeout(() => loadVesselSection(), 1000);
    } else {
        const err = await res?.json();
        msg.innerHTML = `<div class="alert alert-error">${err?.detail||'Save failed'}</div>`;
    }
}

// ─── Users ───────────────────────────────────────────────────────────────────
async function loadUsers() {
    const res = await api('GET', '/users/');
    if (!res || !res.ok) return;
    const users = await res.json();
    const isAdmin = currentUser.role === 'admin';

    document.getElementById('users-container').innerHTML = `
        <div class="section-header">
            <div>
                <h2>Users & Crew</h2>
                <p class="section-sub">${users.length} users registered</p>
            </div>
            ${isAdmin ? `<button class="btn" onclick="showUserModal(null)">+ Add User</button>` : ''}
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr>
                    <th>Full Name</th><th>Username</th><th>Role</th>
                    <th>Rank</th><th>Certificate</th><th>Status</th>
                    ${isAdmin ? '<th>Actions</th>' : ''}
                </tr></thead>
                <tbody>
                ${users.map(u => `<tr>
                    <td><strong>${u.full_name}</strong></td>
                    <td><code>${u.username}</code></td>
                    <td><span class="badge badge-blue">${u.role.replace(/_/g,' ')}</span></td>
                    <td>${u.rank||'-'}</td>
                    <td>${u.certificate_number||'-'}</td>
                    <td>${u.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>'}</td>
                    ${isAdmin ? `<td>
                        <button class="btn btn-sm" onclick='editUser(${JSON.stringify(u)})'>Edit</button>
                        <button class="btn btn-sm btn-warning" onclick="changePassword('${u.id}','${u.username}')">Password</button>
                    </td>` : ''}
                </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

function showUserModal(user) {
    const roles = ['admin','chief_engineer','second_engineer','third_engineer','officer','master','shore_office','port_authority','viewer'];
    const isEdit = !!user;
    openModal(`
        <h2>${isEdit ? 'Edit User' : 'Add New User'}</h2>
        <div class="form-grid">
            <div class="form-group"><label>Full Name *</label><input id="u-name" value="${user?.full_name||''}" placeholder="Full name"></div>
            <div class="form-group"><label>Username *</label><input id="u-username" value="${user?.username||''}" ${isEdit?'disabled':''} placeholder="login username"></div>
            ${!isEdit ? `<div class="form-group"><label>Password *</label><input type="password" id="u-password" placeholder="Password"></div>` : ''}
            <div class="form-group"><label>Role *</label>
                <select id="u-role">${roles.map(r=>`<option value="${r}" ${user?.role===r?'selected':''}>${r.replace(/_/g,' ')}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Rank</label><input id="u-rank" value="${user?.rank||''}" placeholder="e.g. Chief Engineer"></div>
            <div class="form-group"><label>Email</label><input id="u-email" value="${user?.email||''}" placeholder="email@vessel.com"></div>
            <div class="form-group"><label>Certificate No.</label><input id="u-cert" value="${user?.certificate_number||''}" placeholder="Certificate number"></div>
            ${isEdit ? `<div class="form-group"><label>Status</label>
                <select id="u-active"><option value="true" ${user?.is_active?'selected':''}>Active</option><option value="false" ${!user?.is_active?'selected':''}>Inactive</option></select>
            </div>` : ''}
        </div>
        <div class="modal-actions">
            <button class="btn btn-grey" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" onclick="saveUser('${user?.id||''}')">Save User</button>
        </div>
    `);
}

function editUser(user) { showUserModal(user); }

async function saveUser(userId) {
    const data = {
        full_name: document.getElementById('u-name').value,
        role: document.getElementById('u-role').value,
        rank: document.getElementById('u-rank').value || null,
        email: document.getElementById('u-email').value || null,
        certificate_number: document.getElementById('u-cert').value || null,
    };
    if (userId) {
        const activeEl = document.getElementById('u-active');
        if (activeEl) data.is_active = activeEl.value === 'true';
    } else {
        data.username = document.getElementById('u-username').value;
        data.password = document.getElementById('u-password').value;
    }
    const res = await api(userId ? 'PUT' : 'POST', userId ? `/users/${userId}` : '/users/', data);
    if (res && res.ok) { closeModal(); loadUsers(); }
    else {
        const err = await res?.json();
        showModalError(err?.detail || 'Save failed');
    }
}

function changePassword(userId, username) {
    openModal(`
        <h2>Change Password</h2>
        <p style="color:#666;margin-bottom:1rem">User: <strong>${username}</strong></p>
        <div class="form-group"><label>New Password *</label><input type="password" id="new-pwd" placeholder="New password"></div>
        <div class="form-group"><label>Confirm Password *</label><input type="password" id="confirm-pwd" placeholder="Confirm password"></div>
        <div class="modal-actions">
            <button class="btn btn-grey" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" onclick="savePassword('${userId}')">Change Password</button>
        </div>
    `);
}

async function savePassword(userId) {
    const pwd = document.getElementById('new-pwd').value;
    const confirm = document.getElementById('confirm-pwd').value;
    if (pwd !== confirm) { showModalError('Passwords do not match'); return; }
    if (pwd.length < 6) { showModalError('Password must be at least 6 characters'); return; }
    const res = await api('PUT', `/users/${userId}/password`, { new_password: pwd });
    if (res && res.ok) { closeModal(); alert('Password changed successfully'); }
    else { const err = await res?.json(); showModalError(err?.detail || 'Failed'); }
}

// ─── Tanks ───────────────────────────────────────────────────────────────────
async function loadTanks() {
    const [tRes, vRes] = await Promise.all([api('GET','/tanks/'), api('GET','/vessel/')]);
    if (!tRes || !tRes.ok) return;
    const tanks = await tRes.json();
    const vessel = vRes && vRes.ok ? await vRes.json() : null;
    const isAdmin = currentUser.role === 'admin';

    // Group by type
    const groups = {};
    const typeOrder = ['fuel_oil','diesel_oil','lubricating_oil','bilge','slop','ballast','cargo','fresh_water','other'];
    typeOrder.forEach(t => groups[t] = []);
    tanks.forEach(t => { if (groups[t.tank_type]) groups[t.tank_type].push(t); else groups['other'].push(t); });

    const totalCap = tanks.reduce((s,t) => s+t.capacity_m3, 0);

    let html = `
        <div class="section-header">
            <div>
                <h2>Tank Management</h2>
                <p class="section-sub">${tanks.length} tanks — Total capacity: ${totalCap.toFixed(1)} m³</p>
            </div>
            ${isAdmin && vessel ? `<button class="btn" onclick="showTankModal('${vessel.id}')">+ Add Tank</button>` : ''}
        </div>`;

    typeOrder.forEach(type => {
        const group = groups[type];
        if (!group.length) return;
        const groupCap = group.reduce((s,t) => s+t.capacity_m3, 0);
        const label = type.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
        html += `
            <div class="tank-group">
                <div class="tank-group-header">
                    <span class="tank-group-title">${label} Tanks</span>
                    <span class="tank-group-sub">${group.length} tanks — ${groupCap.toFixed(1)} m³ total</span>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Tank Name</th><th>Capacity (m³)</th><th>Position</th><th>Frames</th><th>Ext. System ID</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
                        <tbody>
                        ${group.map(t => `<tr>
                            <td><strong>${t.name}</strong></td>
                            <td>${t.capacity_m3.toFixed(2)}</td>
                            <td>${t.position ? `<span class="badge badge-grey">${t.position}</span>` : '-'}</td>
                            <td>${t.frame_from||'-'} — ${t.frame_to||'-'}</td>
                            <td><code>${t.external_system_id||'-'}</code></td>
                            ${isAdmin ? `<td><button class="btn btn-sm btn-danger" onclick="removeTank('${t.id}','${t.name}')">Remove</button></td>` : ''}
                        </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    });

    document.getElementById('tanks-container').innerHTML = html;
}

function showTankModal(vesselId) {
    const types = ['fuel_oil','diesel_oil','lubricating_oil','ballast','slop','bilge','cargo','fresh_water','other'];
    openModal(`
        <h2>Add Tank</h2>
        <div class="form-grid">
            <div class="form-group"><label>Tank Name *</label><input id="t-name" placeholder="e.g. HFO Tank Port FWD"></div>
            <div class="form-group"><label>Tank Type *</label>
                <select id="t-type">${types.map(t=>`<option value="${t}">${t.replace(/_/g,' ')}</option>`).join('')}</select>
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
            <button class="btn btn-grey" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" onclick="saveTank('${vesselId}')">Add Tank</button>
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
    if (!data.name || !data.capacity_m3) { showModalError('Name and capacity are required'); return; }
    const res = await api('POST', '/tanks/', data);
    if (res && res.ok) { closeModal(); loadTanks(); }
    else { const err = await res?.json(); showModalError(err?.detail || 'Save failed'); }
}

async function removeTank(tankId, tankName) {
    if (!confirm(`Remove tank "${tankName}"? This cannot be undone.`)) return;
    const res = await api('DELETE', `/tanks/${tankId}`);
    if (res && res.ok) loadTanks();
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function openModal(html) {
    closeModal();
    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-overlay" onclick="handleOverlayClick(event)">
            <div class="modal" id="modal-box">
                <div id="modal-error" class="alert alert-error" style="display:none"></div>
                ${html}
            </div>
        </div>`);
}

function closeModal() { document.getElementById('modal-overlay')?.remove(); }
function handleOverlayClick(e) { if (e.target.id === 'modal-overlay') closeModal(); }
function showModalError(msg) { const d = document.getElementById('modal-error'); if(d){d.textContent=msg;d.style.display='block';} }

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('login-screen')?.style.display !== 'none') login();
    if (e.key === 'Escape') closeModal();
});

if (token && currentUser) showApp();
