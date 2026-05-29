const API='/api';
let token=localStorage.getItem('pyorb_token');
let currentUser=JSON.parse(localStorage.getItem('pyorb_user')||'null');
let vesselData=null;
let tanksData=[];
let selectedP1Code=null;
let selectedP2Code=null;

// ── Auth ──────────────────────────────────────────────────────────────────────
async function login(){
  const u=document.getElementById('username').value.trim();
  const p=document.getElementById('password').value.trim();
  const err=document.getElementById('login-error');
  err.style.display='none';
  if(!u||!p){err.textContent='Enter username and password';err.style.display='block';return;}
  try{
    const fd=new FormData();fd.append('username',u);fd.append('password',p);
    const res=await fetch(`${API}/auth/token`,{method:'POST',body:fd});
    const data=await res.json();
    if(!res.ok){err.textContent=data.detail||'Login failed';err.style.display='block';return;}
    token=data.access_token;currentUser=data.user;
    localStorage.setItem('pyorb_token',token);
    localStorage.setItem('pyorb_user',JSON.stringify(currentUser));
    showApp();
  }catch(e){err.textContent='Connection error';err.style.display='block';}
}
function logout(){
  localStorage.removeItem('pyorb_token');localStorage.removeItem('pyorb_user');
  token=null;currentUser=null;vesselData=null;
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
}
async function showApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('topbar-username').textContent=currentUser.full_name;
  document.getElementById('topbar-role').textContent=currentUser.role.replace(/_/g,' ');
  document.getElementById('topbar-avatar').textContent=currentUser.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  await loadVessel();
  await loadTanks();
  switchTab('dashboard');
}

// ── API ───────────────────────────────────────────────────────────────────────
async function req(method,path,body=null){
  const opts={method,headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}};
  if(body)opts.body=JSON.stringify(body);
  const res=await fetch(`${API}${path}`,opts);
  if(res.status===401){logout();return null;}
  return res;
}

// ── Vessel ────────────────────────────────────────────────────────────────────
async function loadVessel(){
  const res=await req('GET','/vessel/');
  if(res&&res.ok){
    vesselData=await res.json();
    document.getElementById('topbar-vesselname').textContent=vesselData.name;
    document.getElementById('topbar-vesselinfo').textContent=
      `IMO ${vesselData.imo_number} | Flag: ${vesselData.flag_state} | Call: ${vesselData.call_sign||'-'}`;
    document.getElementById('topbar-mode').textContent=vesselData.orb_mode_label;
  }else{
    document.getElementById('topbar-vesselname').textContent='Vessel not configured';
    document.getElementById('topbar-mode').textContent='';
  }
}

// ── Tanks ─────────────────────────────────────────────────────────────────────
async function loadTanks(){
  const res=await req('GET','/tanks/');
  if(res&&res.ok)tanksData=await res.json();
}

// ── Tab Navigation ────────────────────────────────────────────────────────────
function switchTab(name){
  document.querySelectorAll('.tab-content').forEach(t=>t.style.display='none');
  document.querySelectorAll('.maintab').forEach(t=>t.classList.remove('active'));
  const tc=document.getElementById(`tab-${name}`);
  if(tc){tc.style.display='block';tc.classList.add('active');}
  const btn=document.querySelector(`.maintab[data-tab="${name}"]`);
  if(btn)btn.classList.add('active');
  if(name==='dashboard')loadDashboard();
  if(name==='operations')loadOperations();
  if(name==='setup'){loadSetupVessel();showSetupSection('vessel');}
  if(name==='audit')loadAuditLog();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard(){
  const [uRes]=await Promise.all([req('GET','/users/')]);
  const users=uRes&&uRes.ok?await uRes.json():[];
  const totalCap=tanksData.reduce((s,t)=>s+t.capacity_m3,0);
  document.getElementById('dash-stats').innerHTML=`
    <div class="stat-card"><div class="stat-val">${tanksData.length}</div><div class="stat-lbl">Tanks</div></div>
    <div class="stat-card"><div class="stat-val">${Math.round(totalCap)}</div><div class="stat-lbl">Total Cap m³</div></div>
    <div class="stat-card"><div class="stat-val">${users.length}</div><div class="stat-lbl">Users</div></div>
    <div class="stat-card"><div class="stat-val">0</div><div class="stat-lbl">ORB Entries</div></div>`;
  renderTankGauges('dash-tanks',tanksData);
}

// ── Tank Gauges ───────────────────────────────────────────────────────────────
const TANK_COLORS={fuel_oil:'g-hfo',diesel_oil:'g-mgo',lubricating_oil:'g-lo',
  bilge:'g-bilge',slop:'g-slop',ballast:'g-ballast',cargo:'g-cargo',
  fresh_water:'g-fw',other:'g-other'};
const TANK_LABELS={fuel_oil:'Heavy Fuel Oil',diesel_oil:'Diesel / MGO',
  lubricating_oil:'Lubricating Oil',bilge:'Bilge',slop:'Slop',
  ballast:'Ballast',cargo:'Cargo',fresh_water:'Fresh Water',other:'Other'};
const TYPE_ORDER=['fuel_oil','diesel_oil','lubricating_oil','bilge','slop','ballast','cargo','fresh_water','other'];

function renderTankGauges(containerId,tanks,selectable=false,onSelect=null){
  const el=document.getElementById(containerId);
  if(!el)return;
  const groups={};
  TYPE_ORDER.forEach(t=>groups[t]=[]);
  tanks.forEach(t=>{const k=t.tank_type in groups?t.tank_type:'other';groups[k].push(t);});
  let html='';
  TYPE_ORDER.forEach(type=>{
    const grp=groups[type];
    if(!grp.length)return;
    const cap=grp.reduce((s,t)=>s+t.capacity_m3,0);
    html+=`<div class="tank-group-label">${TANK_LABELS[type]||type} — ${grp.length} tanks — ${cap.toFixed(0)} m³ total</div>`;
    html+=`<div class="tank-grid">`;
    grp.forEach(t=>{
      // Simulate fill level between 20-90% for demo
      const pct=Math.floor(Math.random()*70+20);
      const vol=(t.capacity_m3*pct/100).toFixed(1);
      const cls=TANK_COLORS[t.tank_type]||'g-other';
      const selAttr=selectable?`onclick="selectTank('${t.id}','${t.name}','${t.tank_type}')"` :'';
      html+=`<div class="tank-card" id="tc-${t.id}" ${selAttr}>
        <div class="tank-name">${t.name.replace('Tank','').replace('tank','').trim()}</div>
        <div class="gauge-wrap">
          <div class="gauge-bar"><div class="gauge-fill ${cls}" style="height:${pct}%"></div></div>
          <div class="gauge-pct">${pct}%</div>
          <div class="gauge-vol">${vol} m³</div>
        </div>
      </div>`;
    });
    html+=`</div>`;
  });
  el.innerHTML=html||'<p style="color:#aaa;padding:10px">No tanks configured</p>';
}

function selectTank(id,name,type){
  document.querySelectorAll('.tank-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById(`tc-${id}`)?.classList.add('selected');
  // Auto-fill tank in the active form
  const p1tank=document.getElementById('p1-tank');
  const p2tank=document.getElementById('p2-tank');
  if(p1tank){p1tank.value=id;}
  if(p2tank){p2tank.value=id;}
}

// ── Operations ────────────────────────────────────────────────────────────────
const PART1_CODES=[
  {code:'A',label:'Ballasting of fuel oil tanks',desc:'Ballasting or cleaning of fuel oil tanks. State tank identity, position, and quantity of water pumped in.'},
  {code:'B',label:'Cleaning of fuel oil tanks',desc:'Cleaning of fuel oil tanks. State tank identity and method of cleaning.'},
  {code:'C',label:'Discharge of dirty ballast',desc:'Discharge of dirty ballast or cleaning water from fuel oil tanks. State method of discharge and quantity.'},
  {code:'D',label:'Cleaning of bilge water',desc:'Cleaning of bilge water. State quantity of bilge water, position, and method used.'},
  {code:'E',label:'Discharge of bilge water',desc:'Discharge overboard, to shore, or to reception facility. State rate, position, OWS reading in PPM.'},
  {code:'F',label:'Condition of OWS / ODM',desc:'Condition of the oil filtering equipment. State any malfunction or repairs done to OWS/ODM.'},
  {code:'G',label:'Accidental / other discharge',desc:'Accidental or other exceptional discharge of oil. State circumstances, quantity, and action taken.'},
  {code:'H',label:'Bunkering of fuel / LO',desc:'Bunkering of fuel oil or bulk lubricating oil. State port, tank identity, quantity, grade of oil.'},
  {code:'I',label:'Additional procedures',desc:'Additional operational procedures and general remarks per MARPOL Annex I.'},
];
const PART2_CODES=[
  {code:'A',label:'Loading of oil cargo',desc:'Loading of oil cargo. State port, tank identity, type and quantity of cargo loaded.'},
  {code:'B',label:'Internal transfer of cargo',desc:'Internal transfer of oil cargo during voyage. State tanks and quantity transferred.'},
  {code:'C',label:'Unloading of oil cargo',desc:'Unloading of oil cargo. State port, tank identity, and quantity discharged.'},
  {code:'D',label:'Ballasting of cargo tanks',desc:'Ballasting of cargo tanks and dedicated clean ballast tanks. State tanks and quantity.'},
  {code:'E',label:'Cleaning of cargo tanks',desc:'Cleaning of cargo tanks including crude oil washing. State method and tanks cleaned.'},
  {code:'F',label:'Discharge of ballast water',desc:'Discharge of dirty ballast water or cleaning water from cargo tanks. State position and quantity.'},
  {code:'G',label:'Accidental / other discharge',desc:'Accidental or exceptional discharge. State circumstances, quantity, and corrective action.'},
];

async function loadOperations(){
  if(!vesselData){await loadVessel();}
  if(!tanksData.length){await loadTanks();}
  document.getElementById('ops-sub').textContent=
    vesselData?`${vesselData.name} — ${vesselData.orb_mode_label}`:'Record ORB operations';

  // Part 1 always shown
  renderOpCodes('part1-codes',PART1_CODES,'part1');
  renderOpsLeftTanks();

  // Part 2 only for tankers
  const p2panel=document.getElementById('part2-panel');
  if(vesselData&&vesselData.requires_part2){
    p2panel.style.display='block';
    renderOpCodes('part2-codes',PART2_CODES,'part2');
  }else{
    p2panel.style.display='none';
  }

  // Set current datetime
  const now=new Date();
  const local=new Date(now-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  ['p1-date','p2-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=local;});

  // Populate tank selects
  populateTankSelect('p1-tank',tanksData);
  populateTankSelect('p2-tank',tanksData.filter(t=>t.tank_type==='cargo'||t.tank_type==='ballast'));
}

function renderOpsLeftTanks(){
  const filter=document.getElementById('ops-tank-filter')?.value||'';
  const filtered=filter?tanksData.filter(t=>t.tank_type===filter):tanksData;
  renderTankGauges('ops-tanks-panel',filtered,true);
}
function filterOpsTanks(){renderOpsLeftTanks();}

function renderOpCodes(containerId,codes,part){
  const el=document.getElementById(containerId);
  if(!el)return;
  el.innerHTML=codes.map(c=>`
    <div class="op-code" id="${part}-code-${c.code}" onclick="selectCode('${part}','${c.code}')">
      <strong>${c.code}</strong> — ${c.label}
    </div>`).join('');
}

function selectCode(part,code){
  const codes=part==='part1'?PART1_CODES:PART2_CODES;
  const found=codes.find(c=>c.code===code);
  if(!found)return;
  document.querySelectorAll(`#${part}-codes .op-code`).forEach(el=>el.classList.remove('active'));
  document.getElementById(`${part}-code-${code}`)?.classList.add('active');
  document.getElementById(`${part}-form`).style.display='block';
  document.getElementById(`${part}-code-desc`).textContent=
    `Code ${code} — ${found.label}: ${found.desc}`;
  if(part==='part1')selectedP1Code=code;
  else selectedP2Code=code;
}

function populateTankSelect(selectId,tanks){
  const el=document.getElementById(selectId);if(!el)return;
  const groups={};
  TYPE_ORDER.forEach(t=>groups[t]=[]);
  tanks.forEach(t=>{const k=t.tank_type in groups?t.tank_type:'other';groups[k].push(t);});
  let html='<option value="">Select tank...</option>';
  TYPE_ORDER.forEach(type=>{
    const grp=groups[type];
    if(!grp.length)return;
    html+=`<optgroup label="${TANK_LABELS[type]||type}">`;
    grp.forEach(t=>html+=`<option value="${t.id}">${t.name} (${t.capacity_m3.toFixed(0)} m³)</option>`);
    html+='</optgroup>';
  });
  el.innerHTML=html;
}

function clearPart1Form(){
  ['p1-tank','p1-lat','p1-lon','p1-port','p1-qty','p1-ppm','p1-remarks'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('part1-form').style.display='none';
  document.querySelectorAll('#part1-codes .op-code').forEach(el=>el.classList.remove('active'));
  selectedP1Code=null;
}
function clearPart2Form(){
  ['p2-tank','p2-lat','p2-lon','p2-port','p2-cargo','p2-qty','p2-remarks'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('part2-form').style.display='none';
  document.querySelectorAll('#part2-codes .op-code').forEach(el=>el.classList.remove('active'));
  selectedP2Code=null;
}

async function submitPart1(){
  if(!selectedP1Code){alert('Please select an operation code');return;}
  const date=document.getElementById('p1-date').value;
  if(!date){alert('Please enter operation date');return;}
  // Phase 3: POST to /api/orb/part1
  alert(`ORB Part I entry ready:\nCode: ${selectedP1Code}\nDate: ${date}\n\nFull submission will be enabled in Phase 3.`);
}
async function submitPart2(){
  if(!selectedP2Code){alert('Please select an operation code');return;}
  const date=document.getElementById('p2-date').value;
  if(!date){alert('Please enter operation date');return;}
  alert(`ORB Part II entry ready:\nCode: ${selectedP2Code}\nDate: ${date}\n\nFull submission will be enabled in Phase 3.`);
}

// ── Setup: Vessel ─────────────────────────────────────────────────────────────
async function loadSetupVessel(){
  const res=await req('GET','/vessel/');
  let v=null;if(res&&res.ok)v=await res.json();
  const isAdmin=currentUser.role==='admin';
  const dis=isAdmin?'':'disabled';
  const types=[
    ['passenger','Passenger Ship'],['bulk_carrier','Bulk Carrier'],
    ['general_cargo','General Cargo'],['container','Container Ship'],
    ['oil_tanker','Oil Tanker'],['product_tanker','Product Tanker'],
    ['chemical_tanker','Chemical Tanker'],['oil_barge','Oil Barge'],['other','Other'],
  ];
  document.getElementById('setup-vessel').innerHTML=`
    <div class="form-card">
      <div class="form-card-header">
        <h2>Vessel Particulars</h2>
        ${v?`<span class="badge badge-green">Configured</span>`:`<span class="badge badge-orange">Not Configured</span>`}
      </div>
      ${v?`<div class="alert alert-info" style="margin-bottom:14px">
        ORB Mode auto-assigned: <strong>${v.orb_mode_label}</strong>
        ${v.requires_part2?' — Part II required (tanker/barge)':' — Part I only (non-tanker)'}
      </div>`:''}
      <div class="form-grid-2">
        <div class="form-group"><label>Vessel Name *</label><input id="v-name" value="${v?.name||''}" ${dis} placeholder="e.g. Marella Explorer 2"></div>
        <div class="form-group"><label>IMO Number *</label><input id="v-imo" value="${v?.imo_number||''}" ${v?'disabled':dis} placeholder="e.g. 9072446"></div>
        <div class="form-group"><label>MMSI</label><input id="v-mmsi" value="${v?.mmsi||''}" ${dis} placeholder="e.g. 249054000"></div>
        <div class="form-group"><label>Call Sign</label><input id="v-call" value="${v?.call_sign||''}" ${dis} placeholder="e.g. 9HJI9"></div>
        <div class="form-group"><label>Flag State *</label><input id="v-flag" value="${v?.flag_state||''}" ${dis} placeholder="e.g. Malta"></div>
        <div class="form-group"><label>Vessel Type * (determines ORB mode)</label>
          <select id="v-type" ${dis} onchange="updateOrbModePreview(this.value)">
            ${types.map(([val,lbl])=>`<option value="${val}" ${v?.vessel_type===val?'selected':''}>${lbl}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Gross Tonnage (GT)</label><input id="v-gt" value="${v?.gross_tonnage||''}" ${dis} placeholder="e.g. 72458"></div>
        <div class="form-group"><label>Deadweight (T)</label><input id="v-dwt" value="${v?.deadweight||''}" ${dis} placeholder="e.g. 7260"></div>
        <div class="form-group"><label>Year Built</label><input id="v-year" value="${v?.year_built||''}" ${dis} placeholder="e.g. 1995"></div>
        <div class="form-group"><label>Owner</label><input id="v-owner" value="${v?.owner||''}" ${dis} placeholder="e.g. TUI Group"></div>
        <div class="form-group"><label>Operator</label><input id="v-oper" value="${v?.operator||''}" ${dis} placeholder="e.g. Marella Cruises"></div>
        <div class="form-group"><label>ORB Mode (auto-assigned)</label>
          <input id="v-mode-display" value="${v?.orb_mode_label||'Will be set based on vessel type'}" disabled style="background:#f0f4f8;color:#555">
        </div>
      </div>
      <div id="vessel-msg"></div>
      ${isAdmin?`<div class="form-actions">
        <button class="btn btn-primary" onclick="saveVessel('${v?.id||''}')">Save Vessel</button>
      </div>`:`<p class="perm-note">Only Admin can edit vessel details.</p>`}
    </div>`;
}

function updateOrbModePreview(type){
  const tankerTypes=['oil_tanker','product_tanker','chemical_tanker','oil_barge'];
  const isTanker=tankerTypes.includes(type);
  const el=document.getElementById('v-mode-display');
  if(el)el.value=isTanker?'Part I + Part II — Tanker Operations':'Part I — Machinery Space Only';
}

async function saveVessel(vesselId){
  const data={
    name:document.getElementById('v-name').value,
    imo_number:document.getElementById('v-imo').value,
    mmsi:document.getElementById('v-mmsi').value||null,
    call_sign:document.getElementById('v-call').value||null,
    flag_state:document.getElementById('v-flag').value,
    vessel_type:document.getElementById('v-type').value,
    gross_tonnage:document.getElementById('v-gt').value||null,
    deadweight:document.getElementById('v-dwt').value||null,
    year_built:document.getElementById('v-year').value||null,
    owner:document.getElementById('v-owner').value||null,
    operator:document.getElementById('v-oper').value||null,
  };
  const res=await req(vesselId?'PUT':'POST',vesselId?`/vessel/${vesselId}`:'/vessel/',data);
  const msg=document.getElementById('vessel-msg');
  if(res&&res.ok){
    msg.innerHTML='<div class="alert alert-success">Vessel saved successfully</div>';
    await loadVessel();setTimeout(()=>loadSetupVessel(),1000);
  }else{
    const err=await res?.json();
    msg.innerHTML=`<div class="alert alert-error">${err?.detail||'Save failed'}</div>`;
  }
}

// ── Setup: Users ──────────────────────────────────────────────────────────────
async function loadSetupUsers(){
  const res=await req('GET','/users/');
  if(!res||!res.ok)return;
  const users=await res.json();
  const isAdmin=currentUser.role==='admin';
  document.getElementById('setup-users').innerHTML=`
    <div class="form-card">
      <div class="section-actions">
        <h2>Users &amp; Crew (${users.length})</h2>
        ${isAdmin?`<button class="btn btn-primary btn-sm" onclick="showUserModal(null)">+ Add User</button>`:''}
      </div>
      <div class="table-wrap" style="overflow-x:auto">
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
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function loadSetupTanks(){
  const [tRes,vRes]=await Promise.all([req('GET','/tanks/'),req('GET','/vessel/')]);
  const tanks=tRes&&tRes.ok?await tRes.json():[];
  const vessel=vRes&&vRes.ok?await vRes.json():null;
  const isAdmin=currentUser.role==='admin';
  const groups={};TYPE_ORDER.forEach(t=>groups[t]=[]);
  tanks.forEach(t=>{const k=t.tank_type in groups?t.tank_type:'other';groups[k].push(t);});
  let html=`<div class="form-card"><div class="section-actions">
    <h2>Tanks (${tanks.length} — ${Math.round(tanks.reduce((s,t)=>s+t.capacity_m3,0))} m³ total)</h2>
    ${isAdmin&&vessel?`<button class="btn btn-primary btn-sm" onclick="showTankModal('${vessel.id}')">+ Add Tank</button>`:''}
  </div>`;
  TYPE_ORDER.forEach(type=>{
    const grp=groups[type];if(!grp.length)return;
    const cap=grp.reduce((s,t)=>s+t.capacity_m3,0);
    html+=`<div class="tank-group-label">${TANK_LABELS[type]||type} — ${grp.length} tanks — ${cap.toFixed(0)} m³</div>
    <div style="overflow-x:auto"><table class="data-table" style="margin-bottom:8px">
      <thead><tr><th>Tank Name</th><th>Capacity m³</th><th>Position</th><th>Frames</th><th>Ext. ID</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
      <tbody>${grp.map(t=>`<tr>
        <td><strong>${t.name}</strong></td>
        <td>${t.capacity_m3.toFixed(2)}</td>
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

function showSetupSection(name){
  ['vessel','users','tanks'].forEach(s=>{
    const el=document.getElementById(`setup-${s}`);if(el)el.style.display=s===name?'block':'none';
  });
  document.querySelectorAll('.setup-nav-item').forEach(el=>el.classList.remove('active'));
  const items=document.querySelectorAll('.setup-nav-item');
  const idx={vessel:0,users:1,tanks:2}[name]??0;
  if(items[idx])items[idx].classList.add('active');
  if(name==='vessel')loadSetupVessel();
  if(name==='users')loadSetupUsers();
  if(name==='tanks')loadSetupTanks();
}

// ── User Modal ────────────────────────────────────────────────────────────────
function showUserModal(user){
  const roles=['admin','chief_engineer','second_engineer','third_engineer','officer','master','shore_office','port_authority','viewer'];
  const isEdit=!!user;
  openModal(`<h2>${isEdit?'Edit User':'Add User'}</h2>
    <div class="form-grid-2">
      <div class="form-group"><label>Full Name *</label><input id="u-name" value="${user?.full_name||''}" placeholder="Full name"></div>
      <div class="form-group"><label>Username *</label><input id="u-username" value="${user?.username||''}" ${isEdit?'disabled':''} placeholder="username"></div>
      ${!isEdit?`<div class="form-group"><label>Password *</label><input type="password" id="u-password" placeholder="Password"></div>`:''}
      <div class="form-group"><label>Role *</label><select id="u-role">${roles.map(r=>`<option value="${r}" ${user?.role===r?'selected':''}>${r.replace(/_/g,' ')}</option>`).join('')}</select></div>
      <div class="form-group"><label>Rank</label><input id="u-rank" value="${user?.rank||''}" placeholder="e.g. Chief Engineer"></div>
      <div class="form-group"><label>Email</label><input id="u-email" value="${user?.email||''}" placeholder="email@vessel.com"></div>
      <div class="form-group"><label>Certificate No.</label><input id="u-cert" value="${user?.certificate_number||''}" placeholder="Cert number"></div>
      ${isEdit?`<div class="form-group"><label>Status</label><select id="u-active"><option value="true" ${user?.is_active?'selected':''}>Active</option><option value="false" ${!user?.is_active?'selected':''}>Inactive</option></select></div>`:''}
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveUser('${user?.id||''}')">Save</button>
    </div>`);
}

async function saveUser(userId){
  const data={full_name:document.getElementById('u-name').value,role:document.getElementById('u-role').value,rank:document.getElementById('u-rank').value||null,email:document.getElementById('u-email').value||null,certificate_number:document.getElementById('u-cert').value||null};
  if(userId){const a=document.getElementById('u-active');if(a)data.is_active=a.value==='true';}
  else{data.username=document.getElementById('u-username').value;data.password=document.getElementById('u-password').value;}
  const res=await req(userId?'PUT':'POST',userId?`/users/${userId}`:'/users/',data);
  if(res&&res.ok){closeModal();loadSetupUsers();}
  else{const err=await res?.json();showModalAlert(err?.detail||'Failed');}
}

function showPwdModal(userId,username){
  openModal(`<h2>Change Password</h2>
    <p style="color:#888;margin-bottom:14px">User: <strong>${username}</strong></p>
    <div class="form-group"><label>New Password *</label><input type="password" id="new-pwd" placeholder="Min 6 characters"></div>
    <div class="form-group"><label>Confirm Password *</label><input type="password" id="conf-pwd" placeholder="Repeat password"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePwd('${userId}')">Change Password</button>
    </div>`);
}
async function savePwd(userId){
  const p=document.getElementById('new-pwd').value;
  const c=document.getElementById('conf-pwd').value;
  if(p!==c){showModalAlert('Passwords do not match');return;}
  if(p.length<6){showModalAlert('Minimum 6 characters');return;}
  const res=await req('PUT',`/users/${userId}/password`,{new_password:p});
  if(res&&res.ok){closeModal();alert('Password changed successfully');}
  else{const err=await res?.json();showModalAlert(err?.detail||'Failed');}
}

// ── Tank Modal ────────────────────────────────────────────────────────────────
function showTankModal(vesselId){
  const types=TYPE_ORDER;
  openModal(`<h2>Add Tank</h2>
    <div class="form-grid-2">
      <div class="form-group"><label>Tank Name *</label><input id="t-name" placeholder="e.g. HFO Tank Port FWD"></div>
      <div class="form-group"><label>Tank Type *</label><select id="t-type">${types.map(t=>`<option value="${t}">${TANK_LABELS[t]||t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Capacity (m³) *</label><input type="number" step="0.01" id="t-cap" placeholder="e.g. 850.00"></div>
      <div class="form-group"><label>Position</label><select id="t-pos"><option value="">-</option><option value="port">Port</option><option value="starboard">Starboard</option><option value="center">Center</option></select></div>
      <div class="form-group"><label>Frame From</label><input id="t-ff" placeholder="e.g. 20"></div>
      <div class="form-group"><label>Frame To</label><input id="t-ft" placeholder="e.g. 45"></div>
      <div class="form-group"><label>External System ID</label><input id="t-ext" placeholder="Valmarine / Kongsberg / NAPA ID"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveTank('${vesselId}')">Add Tank</button>
    </div>`);
}
async function saveTank(vesselId){
  const data={vessel_id:vesselId,name:document.getElementById('t-name').value,tank_type:document.getElementById('t-type').value,capacity_m3:parseFloat(document.getElementById('t-cap').value),position:document.getElementById('t-pos').value||null,frame_from:document.getElementById('t-ff').value||null,frame_to:document.getElementById('t-ft').value||null,external_system_id:document.getElementById('t-ext').value||null};
  if(!data.name||!data.capacity_m3){showModalAlert('Name and capacity required');return;}
  const res=await req('POST','/tanks/',data);
  if(res&&res.ok){closeModal();await loadTanks();loadSetupTanks();}
  else{const err=await res?.json();showModalAlert(err?.detail||'Failed');}
}
async function removeTank(id,name){
  if(!confirm(`Remove tank "${name}"?`))return;
  const res=await req('DELETE',`/tanks/${id}`);
  if(res&&res.ok){await loadTanks();loadSetupTanks();}
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
async function loadAuditLog(){
  document.getElementById('audit-entries').innerHTML='<tr><td colspan="5" class="empty-row">Loading...</td></tr>';
  // Phase 3: GET /api/audit/
  document.getElementById('audit-entries').innerHTML='<tr><td colspan="5" class="empty-row">Audit log API coming in Phase 3 — all actions are already being recorded in the database.</td></tr>';
}

// ── Modal Helpers ─────────────────────────────────────────────────────────────
function openModal(html){
  closeModal();
  document.getElementById('modal-box').innerHTML=html;
  document.getElementById('modal-overlay').style.display='flex';
}
function closeModal(){document.getElementById('modal-overlay').style.display='none';}
function handleOverlay(e){if(e.target.id==='modal-overlay')closeModal();}
function showModalAlert(msg){
  let a=document.getElementById('modal-alert');
  if(!a){a=document.createElement('div');a.id='modal-alert';a.className='alert alert-error';document.getElementById('modal-box').prepend(a);}
  a.textContent=msg;
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.getElementById('login-screen')?.style.display!=='none')login();
  if(e.key==='Escape')closeModal();
});
if(token&&currentUser)showApp();
