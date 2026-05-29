const API='/api';
let token=localStorage.getItem('pyorb_token');
let currentUser=JSON.parse(localStorage.getItem('pyorb_user')||'null');
let vesselData=null, tanksData=[], appInfo=null;
let selectedTank=null, selectedCode=null, selectedPart=null;
let tankCharts={};
let gpsConfig={source:'manual',lat:null,lon:null};
let recentOpsLimit=10;

// ── Constants ──────────────────────────────────────────────────────────────────
const TANK_COLORS={fuel_oil:'#185FA5',diesel_oil:'#1D9E75',lubricating_oil:'#BA7517',bilge:'#D85A30',slop:'#993C1D',ballast:'#534AB7',cargo:'#3B6D11',fresh_water:'#0F6E56',other:'#5F5E5A'};
const TANK_CSS={fuel_oil:'g-hfo',diesel_oil:'g-mgo',lubricating_oil:'g-lo',bilge:'g-bilge',slop:'g-slop',ballast:'g-ballast',cargo:'g-cargo',fresh_water:'g-fw',other:'g-other'};
const TANK_LABELS={fuel_oil:'Heavy Fuel Oil',diesel_oil:'Diesel / MGO',lubricating_oil:'Lubricating Oil',bilge:'Bilge',slop:'Slop',ballast:'Ballast',cargo:'Cargo',fresh_water:'Fresh Water',other:'Other'};
const TYPE_ORDER=['fuel_oil','diesel_oil','lubricating_oil','bilge','slop','ballast','cargo','fresh_water','other'];

const PART1_CODES=[
  {code:'A',label:'Ballasting of fuel oil tanks',     tanks:['fuel_oil','ballast'],                        desc:'Ballasting or cleaning of fuel oil tanks. State tank identity, position, quantity pumped in (m³).'},
  {code:'B',label:'Cleaning of fuel oil tanks',       tanks:['fuel_oil'],                                  desc:'Cleaning of fuel oil tanks. State tank identity and method of cleaning.'},
  {code:'C',label:'Discharge of dirty ballast',       tanks:['fuel_oil','ballast','slop'],                 desc:'Discharge of dirty ballast or cleaning water. State method and quantity discharged (m³).'},
  {code:'D',label:'Cleaning of bilge water',          tanks:['bilge'],                                     desc:'Cleaning of bilge holding tanks. State quantity, position and method used.'},
  {code:'E',label:'Discharge of bilge water',         tanks:['bilge','slop'],                              desc:'Discharge overboard or to reception facility. State position, OWS rate, PPM reading and total quantity. PPM reading is mandatory.'},
  {code:'F',label:'Condition of OWS / ODM',           tanks:[],                                            desc:'Condition of oil filtering equipment. State any malfunction or repairs. Not tank-specific.'},
  {code:'G',label:'Accidental / other discharge',     tanks:['__any__'],                                   desc:'Accidental or exceptional discharge. State time, position, quantity, circumstances and action taken. Remarks are mandatory.'},
  {code:'H',label:'Bunkering of fuel / LO',           tanks:['fuel_oil','diesel_oil','lubricating_oil'],   desc:'Bunkering of fuel oil or bulk lubricating oil. State port, tank, grade, quantity received in m³ and metric tons.'},
  {code:'I',label:'Additional procedures / remarks',  tanks:['__any__'],                                   desc:'Any other operation required by MARPOL Annex I or general remarks.'},
];
const PART2_CODES=[
  {code:'A',label:'Loading of oil cargo',             tanks:['cargo'],                     desc:'Loading of oil cargo. State port, tank identity, type and quantity of cargo (m³).'},
  {code:'B',label:'Internal transfer of cargo',       tanks:['cargo'],                     desc:'Internal transfer during voyage. State from/to tanks and quantity transferred (m³).'},
  {code:'C',label:'Unloading of oil cargo',           tanks:['cargo'],                     desc:'Unloading of oil cargo. State port, tank identity, quantity discharged and quantity remaining.'},
  {code:'D',label:'Ballasting of cargo tanks',        tanks:['cargo','ballast'],           desc:'Ballasting of cargo tanks or CBT. State tank identity, position and quantity (m³).'},
  {code:'E',label:'Cleaning of cargo tanks',          tanks:['cargo'],                     desc:'Tank cleaning including COW. State tanks, method and quantity of cleaning water.'},
  {code:'F',label:'Discharge of ballast water',       tanks:['cargo','ballast','slop'],    desc:'Discharge of ballast or cleaning water. State position, quantity (m³) and PPM at discharge point.'},
  {code:'G',label:'Accidental / other discharge',     tanks:['__any__'],                   desc:'Accidental discharge. State time, position, quantity, type of oil, circumstances and action taken. Remarks are mandatory.'},
];

// ── App Init ──────────────────────────────────────────────────────────────────
async function loadAppInfo(){
  try{const r=await fetch('/api/appinfo');if(r.ok){appInfo=await r.json();renderModeBar();}}catch(e){}
}
function renderModeBar(){
  if(!appInfo)return;
  const el=document.getElementById('topbar-mode-label');
  if(el){el.textContent=appInfo.mode_label;el.style.background=appInfo.mode==='ship'?'rgba(255,255,255,0.15)':'rgba(167,139,250,0.4)';}
}

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
    await initApp();
  }catch(e){err.textContent='Connection error';err.style.display='block';}
}

function logout(){
  localStorage.removeItem('pyorb_token');localStorage.removeItem('pyorb_user');
  token=null;currentUser=null;vesselData=null;
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
}

async function initApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('topbar-username').textContent=currentUser.full_name;
  document.getElementById('topbar-role').textContent=currentUser.role.replace(/_/g,' ');
  document.getElementById('topbar-avatar').textContent=currentUser.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  await loadAppInfo();
  await loadVessel();
  await loadTanks();
  switchTab('dashboard');
}

async function req(method,path,body=null){
  const opts={method,headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}};
  if(body)opts.body=JSON.stringify(body);
  const res=await fetch(`${API}${path}`,opts);
  if(res.status===401){logout();return null;}
  return res;
}

async function loadVessel(){
  const res=await req('GET','/vessel/');
  if(res&&res.ok){
    vesselData=await res.json();
    document.getElementById('topbar-vesselname').textContent=vesselData.name;
    document.getElementById('topbar-vesselinfo').textContent=`IMO ${vesselData.imo_number} | Flag: ${vesselData.flag_state} | Call: ${vesselData.call_sign||'-'}`;
    document.getElementById('topbar-mode').textContent=vesselData.orb_mode_label;
  }else{
    document.getElementById('topbar-vesselname').textContent='Vessel not configured';
  }
}

async function loadTanks(){
  const res=await req('GET','/tanks/');
  if(res&&res.ok)tanksData=await res.json();
  checkAlarms();
}

function checkAlarms(){
  const alarmed=tanksData.filter(t=>t.alarm_enabled&&(t.fill_pct>=t.alarm_high_pct||t.fill_pct<=t.alarm_low_pct));
  const bar=document.getElementById('alarm-bar');
  if(alarmed.length){
    bar.innerHTML=`<strong>&#128276; TANK ALARMS:</strong> `+alarmed.map(t=>{
      const hi=t.fill_pct>=t.alarm_high_pct;
      return `<span>${t.name}: ${t.fill_pct}% ${hi?'(HIGH)':'(LOW)'}</span>`;
    }).join(' | ');
    bar.style.display='flex';
  }else{bar.style.display='none';}
}

// ── Tab Navigation ────────────────────────────────────────────────────────────
function switchTab(name){
  document.querySelectorAll('.tab-content').forEach(t=>t.style.display='none');
  document.querySelectorAll('.maintab').forEach(t=>t.classList.remove('active'));
  document.getElementById(`tab-${name}`)?.classList.add('active');
  document.getElementById(`tab-${name}`).style.display='block';
  document.querySelector(`.maintab[data-tab="${name}"]`)?.classList.add('active');
  if(name==='dashboard')renderTanks();
  if(name==='setup'){showSetupSection('vessel');}
}

// ── Tank Rendering ────────────────────────────────────────────────────────────
function filterTanks(){renderTanks();}

function renderTanks(){
  const filter=document.getElementById('tank-filter')?.value||'';
  const tanks=filter?tanksData.filter(t=>t.tank_type===filter):tanksData;
  const groups={};TYPE_ORDER.forEach(t=>groups[t]=[]);
  tanks.forEach(t=>{const k=t.tank_type in groups?t.tank_type:'other';groups[k].push(t);});
  let html='';
  TYPE_ORDER.forEach(type=>{
    const grp=groups[type];if(!grp.length)return;
    const cap=grp.reduce((s,t)=>s+t.capacity_m3,0);
    html+=`<div class="tank-group-label">${TANK_LABELS[type]||type} — ${grp.length} tanks — ${cap.toFixed(0)} m³</div><div class="tank-grid">`;
    grp.forEach(t=>{
      const pct=Math.round(t.fill_pct||0);
      const vol=(t.current_volume_m3||0).toFixed(1);
      const cls=TANK_CSS[t.tank_type]||'g-other';
      const alarmCls=t.alarm_enabled?(t.fill_pct>=(t.alarm_high_pct||101)?'tank-alarm-high':t.fill_pct<=(t.alarm_low_pct||-1)?'tank-alarm-low':''):'';
      const isSel=selectedTank?.id===t.id?'selected':'';
      html+=`<div class="tank-card ${isSel} ${alarmCls}" id="tc-${t.id}" onclick="selectTank('${t.id}')">
        <div class="tank-name">${t.name}</div>
        <div class="gauge-wrap">
          <div class="gauge-bar"><div class="gauge-fill ${cls}" style="height:${pct}%"></div></div>
          <div class="gauge-pct">${pct}%</div>
          <div class="gauge-vol">${vol} m³</div>
        </div>
      </div>`;
    });
    html+=`</div>`;
  });
  document.getElementById('tanks-panel').innerHTML=html||'<p style="color:#aaa;padding:10px">No tanks configured</p>';
}

// ── Tank Selection & Right Panel ──────────────────────────────────────────────
async function selectTank(id){
  const tank=tanksData.find(t=>t.id===id);
  if(!tank)return;
  selectedTank=tank;selectedCode=null;selectedPart=null;

  document.querySelectorAll('.tank-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById(`tc-${id}`)?.classList.add('selected');

  // Fetch history
  const histRes=await req('GET',`/orb/tank/${id}/history?limit=30`);
  const hist=histRes&&histRes.ok?await histRes.json():null;

  // Fetch recent entries
  const entRes=await req('GET',`/orb/part1?tank_id=${id}&limit=${recentOpsLimit}`);
  const entries=entRes&&entRes.ok?await entRes.json():[];

  renderRightPanel(tank, hist, entries);
}

function renderRightPanel(tank, hist, entries){
  const pct=Math.round(tank.fill_pct||0);
  const vol=(tank.current_volume_m3||0).toFixed(2);
  const avail=(tank.available_m3||tank.capacity_m3).toFixed(2);
  const cls=TANK_CSS[tank.tank_type]||'g-other';
  const alarmCls=tank.alarm_enabled?(pct>=(tank.alarm_high_pct||101)?'tank-alarm-high':pct<=(tank.alarm_low_pct||-1)?'tank-alarm-low':''):'';
  const alarmTag=tank.alarm_enabled?(pct>=(tank.alarm_high_pct||101)?`<span class="alarm-tag alarm-tag-high">HIGH</span>`:pct<=(tank.alarm_low_pct||-1)?`<span class="alarm-tag alarm-tag-low">LOW</span>`:''):'';

  // Build valid codes
  const validP1=PART1_CODES.filter(c=>c.tanks.includes(tank.tank_type)||c.tanks.includes('__any__')||c.tanks.length===0);
  const validP2=vesselData?.requires_part2?PART2_CODES.filter(c=>c.tanks.includes(tank.tank_type)||c.tanks.includes('__any__')):[];

  let html=`<div class="rpanel">
    <div class="rpanel-header">
      <div class="rpanel-title">${tank.name} ${alarmTag}</div>
      <div class="rpanel-sub">${TANK_LABELS[tank.tank_type]||tank.tank_type} — ${tank.capacity_m3.toFixed(0)} m³ capacity</div>
    </div>
    <div class="rpanel-body">

      <!-- Tank info bar -->
      <div class="tank-info-bar ${alarmCls}">
        <div class="tank-big-gauge"><div class="gauge-fill ${cls}" style="height:${pct}%"></div></div>
        <div class="tank-info-text">
          <div class="tank-info-name">${pct}% full</div>
          <div class="tank-info-stats">
            <span>Current: <strong>${vol} m³</strong></span>
            <span>Available: <strong>${avail} m³</strong></span>
            <span>Capacity: <strong>${tank.capacity_m3.toFixed(0)} m³</strong></span>
            ${tank.alarm_enabled?`<span>Alarm: H=${tank.alarm_high_pct}% L=${tank.alarm_low_pct}%</span>`:''}
          </div>
        </div>
      </div>

      <!-- Volume history chart -->
      <div class="tank-chart-wrap">
        <div class="recent-ops-header"><span>Volume History</span></div>
        ${hist&&hist.history&&hist.history.length
          ?`<canvas id="tank-chart-${tank.id}" height="120"></canvas>`
          :`<div class="chart-empty">No history yet — volume will be tracked after first entry</div>`}
      </div>

      <!-- Recent operations -->
      <div class="recent-ops-header">
        <span>Recent Operations</span>
        <select onchange="recentOpsLimit=this.value;selectTank('${tank.id}')" class="sel-sm" style="font-size:.72rem">
          <option value="10" ${recentOpsLimit==10?'selected':''}>Last 10</option>
          <option value="20" ${recentOpsLimit==20?'selected':''}>Last 20</option>
          <option value="50" ${recentOpsLimit==50?'selected':''}>Last 50</option>
        </select>
      </div>
      <div style="overflow-x:auto;margin-bottom:14px">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Code</th><th>Qty m³</th><th>Officer</th></tr></thead>
          <tbody>`;

  if(entries.length){
    entries.forEach(e=>{
      const d=new Date(e.operation_date).toLocaleDateString();
      html+=`<tr>
        <td>${d}</td>
        <td><span class="badge badge-blue">${e.operation_code}</span></td>
        <td>${e.quantity_m3!=null?e.quantity_m3.toFixed(2):'-'}</td>
        <td>${e.officer}</td>
      </tr>`;
    });
  }else{
    html+=`<tr><td colspan="4" class="empty-row">No entries for this tank yet</td></tr>`;
  }

  html+=`</tbody></table></div>

      <!-- Operation Codes -->
      <div class="codes-section">
        <div class="codes-label">Record Operation — Part I (Machinery Space)</div>
        <div class="op-codes-grid">`;

  PART1_CODES.forEach(c=>{
    const valid=c.tanks.includes(tank.tank_type)||c.tanks.includes('__any__')||c.tanks.length===0;
    html+=`<div class="op-code ${valid?'':'op-disabled'} ${selectedCode===c.code&&selectedPart==='p1'?'op-active':''}"
      id="opc-p1-${c.code}" onclick="${valid?`pickCode('p1','${c.code}')`:''}"
      title="${valid?'':'Not applicable for '+TANK_LABELS[tank.tank_type]+' tanks'}">
      <span class="op-badge">${c.code}</span>
      <span class="op-label">${c.label}</span>
    </div>`;
  });
  html+=`</div>`;

  if(vesselData?.requires_part2&&validP2.length){
    html+=`<div class="codes-label" style="margin-top:12px">Record Operation — Part II (Cargo/Ballast)</div>
      <div class="op-codes-grid">`;
    PART2_CODES.forEach(c=>{
      const valid=c.tanks.includes(tank.tank_type)||c.tanks.includes('__any__');
      html+=`<div class="op-code ${valid?'':'op-disabled'} ${selectedCode===c.code&&selectedPart==='p2'?'op-active':''}"
        id="opc-p2-${c.code}" onclick="${valid?`pickCode('p2','${c.code}')`:''}"
        title="${valid?'':'Not applicable'}">
        <span class="op-badge">${c.code}</span>
        <span class="op-label">${c.label}</span>
      </div>`;
    });
    html+=`</div>`;
  }

  html+=`</div><!-- codes-section -->

      <!-- Entry form (shown when code picked) -->
      <div id="entry-form-wrap" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
        <div id="entry-code-desc" class="code-desc-box"></div>
        <div id="entry-errors"></div>
        <div id="entry-warnings"></div>
        <div class="form-row-2">
          <div class="form-group"><label>Operation Date &amp; Time *</label>
            <input type="datetime-local" id="op-date" value="${new Date(new Date()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}">
          </div>
          <div class="form-group"><label>Ship Status</label>
            <select id="op-status">
              <option value="unknown">Unknown</option>
              <option value="en_route">En route</option>
              <option value="approaching">Approaching port</option>
              <option value="at_anchor">At anchor</option>
              <option value="in_port">In port / at berth</option>
              <option value="maneuvering">Maneuvering</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>Port (if in port)</label><input type="text" id="op-port" placeholder="Port name"></div>
        <div class="form-group"><label>Position</label>
          <div class="pos-row">
            <div class="form-group"><label>Latitude</label><input type="text" id="op-lat" placeholder="e.g. 35.6892 N"></div>
            <div class="form-group"><label>Longitude</label><input type="text" id="op-lon" placeholder="e.g. 14.3754 E"></div>
            <button class="btn-map" onclick="openMapPicker()" title="Pick from map">&#127758; Map</button>
            <button class="btn-map" onclick="getGpsPosition()" title="Use GPS">&#128225; GPS</button>
          </div>
        </div>
        <div class="form-row-2">
          <div class="form-group"><label>Quantity (m³)</label>
            <input type="number" step="0.01" id="op-qty" placeholder="0.00" oninput="validateQtyLive(this.value)">
          </div>
          <div id="officer-group" class="form-group"><label>Responsible Officer *</label>
            <select id="op-officer"></select>
          </div>
        </div>
        <div id="ppm-row" class="form-row-2" style="display:none">
          <div class="form-group"><label>OWS Rate (m³/h)</label><input type="number" step="0.1" id="op-ows" placeholder="0.0"></div>
          <div class="form-group"><label>Oil Content (PPM) *</label><input type="number" step="0.1" id="op-ppm" placeholder="ODM reading"></div>
        </div>
        <div id="cargo-row" class="form-group" style="display:none">
          <label>Cargo Type</label><input type="text" id="op-cargo" placeholder="e.g. Crude Oil, VLSFO">
        </div>
        <div class="form-group"><label>Remarks <span id="remarks-req" style="display:none;color:#e74c3c">*required</span></label>
          <textarea id="op-remarks" rows="2" placeholder="Additional details, references, circumstances..."></textarea>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="clearEntryForm()">Clear</button>
          <button class="btn btn-primary" onclick="submitEntry()">&#10003; Submit ORB Entry</button>
        </div>
      </div>

    </div><!-- rpanel-body -->
  </div><!-- rpanel -->`;

  document.getElementById('right-panel').innerHTML=html;

  // Draw chart if history exists
  if(hist&&hist.history&&hist.history.length){
    drawTankChart(tank.id, tank.capacity_m3, hist.history);
  }

  // Populate officer select
  loadOfficers();
}

function drawTankChart(tankId, capacity, history){
  setTimeout(()=>{
    const canvas=document.getElementById(`tank-chart-${tankId}`);
    if(!canvas)return;
    if(tankCharts[tankId]){tankCharts[tankId].destroy();}
    const labels=history.map(h=>new Date(h.date).toLocaleDateString());
    const volumes=history.map(h=>h.volume_m3);
    const capLine=history.map(()=>capacity);
    tankCharts[tankId]=new Chart(canvas,{
      type:'line',
      data:{
        labels,
        datasets:[
          {label:'Volume m³',data:volumes,borderColor:'#2e86c1',backgroundColor:'rgba(46,134,193,0.1)',fill:true,tension:0.3,pointRadius:3},
          {label:'Capacity',data:capLine,borderColor:'#e74c3c',borderDash:[4,4],fill:false,pointRadius:0},
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          y:{beginAtZero:true,ticks:{font:{size:9}},title:{display:true,text:'m³',font:{size:9}}},
          x:{ticks:{font:{size:9},maxRotation:0}}
        }
      }
    });
  },100);
}

async function loadOfficers(){
  const res=await req('GET','/users/');
  if(!res||!res.ok)return;
  const users=await res.json();
  const sel=document.getElementById('op-officer');
  if(!sel)return;
  const writeRoles=['admin','chief_engineer','second_engineer','third_engineer','officer'];
  const officers=users.filter(u=>writeRoles.includes(u.role)&&u.is_active);
  sel.innerHTML='<option value="">Select officer...</option>'+
    officers.map(u=>`<option value="${u.id}" ${u.id===currentUser.id?'selected':''}>${u.full_name} (${u.rank||u.role})</option>`).join('');
}

// ── Code Selection ────────────────────────────────────────────────────────────
function pickCode(part, code){
  const codes=part==='p1'?PART1_CODES:PART2_CODES;
  const found=codes.find(c=>c.code===code);
  if(!found)return;
  selectedCode=code;selectedPart=part;

  document.querySelectorAll('.op-code').forEach(el=>el.classList.remove('op-active'));
  document.getElementById(`opc-${part}-${code}`)?.classList.add('op-active');

  document.getElementById('entry-code-desc').textContent=`Code ${code} — ${found.label}: ${found.desc}`;
  document.getElementById('entry-form-wrap').style.display='block';

  // Show/hide special fields
  const showPPM=(part==='p1'&&(code==='E'||code==='F'));
  const showCargo=part==='p2';
  const showRemarks=code==='G';
  document.getElementById('ppm-row').style.display=showPPM?'grid':'none';
  document.getElementById('cargo-row').style.display=showCargo?'block':'none';
  document.getElementById('remarks-req').style.display=showRemarks?'inline':'none';

  // Scroll to form
  document.getElementById('entry-form-wrap').scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ── Live Quantity Validation ──────────────────────────────────────────────────
async function validateQtyLive(qty){
  if(!selectedTank||!selectedCode||!qty)return;
  const res=await req('POST','/orb/validate',{
    tank_id:selectedTank.id,
    operation_code:selectedCode,
    quantity_m3:parseFloat(qty),
    part:selectedPart
  });
  if(!res||!res.ok)return;
  const data=await res.json();
  const errDiv=document.getElementById('entry-errors');
  const warnDiv=document.getElementById('entry-warnings');
  errDiv.innerHTML=data.errors.length?`<div class="validation-errors">${data.errors.map(e=>`<p>&#10007; ${e}</p>`).join('')}</div>`:'';
  warnDiv.innerHTML=data.warnings.length?`<div class="validation-warnings">${data.warnings.map(w=>`<p>&#9888; ${w}</p>`).join('')}</div>`:'';
}

// ── Submit Entry ──────────────────────────────────────────────────────────────
async function submitEntry(){
  if(!selectedCode||!selectedPart){alert('Select an operation code');return;}
  const date=document.getElementById('op-date')?.value;
  if(!date){alert('Operation date is required');return;}
  const officerId=document.getElementById('op-officer')?.value;
  if(!officerId){alert('Select the responsible officer');return;}
  if(selectedCode==='G'&&!document.getElementById('op-remarks')?.value.trim()){
    alert('Code G requires remarks explaining the circumstances');return;
  }
  if(selectedPart==='p1'&&selectedCode==='E'&&!document.getElementById('op-ppm')?.value){
    alert('Code E requires a PPM reading from the ODM');return;
  }

  const payload={
    vessel_id:vesselData.id,
    officer_id:officerId,
    operation_code:selectedCode,
    operation_date:date,
    ship_status:document.getElementById('op-status')?.value||'unknown',
    position_lat:parseFloat(document.getElementById('op-lat')?.value)||null,
    position_lon:parseFloat(document.getElementById('op-lon')?.value)||null,
    position_source:gpsConfig.source||'manual',
    port_name:document.getElementById('op-port')?.value||null,
    tank_id:selectedTank.id,
    quantity_m3:parseFloat(document.getElementById('op-qty')?.value)||null,
    ows_rate:parseFloat(document.getElementById('op-ows')?.value)||null,
    oil_content_ppm:parseFloat(document.getElementById('op-ppm')?.value)||null,
    cargo_type:document.getElementById('op-cargo')?.value||null,
    remarks:document.getElementById('op-remarks')?.value||null,
  };

  const endpoint=selectedPart==='p1'?'/orb/part1':'/orb/part2';
  const res=await req('POST',endpoint,payload);
  if(res&&res.ok){
    // Reload tank data and refresh panel
    await loadTanks();
    renderTanks();
    // Re-select tank to refresh panel
    const updated=tanksData.find(t=>t.id===selectedTank.id);
    if(updated){selectedTank=updated;await selectTank(updated.id);}
    showToast('ORB entry recorded successfully','success');
  }else{
    const err=await res?.json();
    const errDiv=document.getElementById('entry-errors');
    if(errDiv)errDiv.innerHTML=`<div class="validation-errors"><p>&#10007; ${err?.detail||'Submission failed'}</p></div>`;
    errDiv?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}

function clearEntryForm(){
  ['op-port','op-lat','op-lon','op-qty','op-ows','op-ppm','op-cargo','op-remarks'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('entry-form-wrap').style.display='none';
  document.getElementById('entry-errors').innerHTML='';
  document.getElementById('entry-warnings').innerHTML='';
  document.querySelectorAll('.op-code').forEach(el=>el.classList.remove('op-active'));
  selectedCode=null;selectedPart=null;
}

// ── GPS ───────────────────────────────────────────────────────────────────────
function getGpsPosition(){
  if(gpsConfig.source==='manual'||!gpsConfig.lat){
    // Try browser geolocation
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        document.getElementById('op-lat').value=pos.coords.latitude.toFixed(6);
        document.getElementById('op-lon').value=pos.coords.longitude.toFixed(6);
        gpsConfig.source='browser_gps';
        showToast('Position obtained from browser GPS','success');
      },()=>showToast('GPS unavailable — enter manually or use map picker','warning'));
    }else{showToast('GPS not available in this browser','warning');}
  }else{
    document.getElementById('op-lat').value=gpsConfig.lat;
    document.getElementById('op-lon').value=gpsConfig.lon;
  }
}

function openMapPicker(){
  const lat=document.getElementById('op-lat')?.value||35.0;
  const lon=document.getElementById('op-lon')?.value||15.0;
  const mapModal=document.getElementById('map-modal');
  // Use OpenStreetMap embed (no API key needed)
  const frame=document.getElementById('map-frame');
  frame.src=`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lon)-5},${parseFloat(lat)-5},${parseFloat(lon)+5},${parseFloat(lat)+5}&layer=mapnik&marker=${lat},${lon}`;
  document.getElementById('map-lat').value=lat;
  document.getElementById('map-lon').value=lon;
  mapModal.style.display='flex';
}

function closeMapModal(){document.getElementById('map-modal').style.display='none';}

function applyMapPosition(){
  const lat=document.getElementById('map-lat').value;
  const lon=document.getElementById('map-lon').value;
  document.getElementById('op-lat').value=lat;
  document.getElementById('op-lon').value=lon;
  closeMapModal();
}

// ── Reports ───────────────────────────────────────────────────────────────────
function clearFilters(){
  ['f-date-from','f-date-to','f-port','f-officer','f-qty-from','f-qty-to'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  ['f-part','f-code','f-tank-type'].forEach(id=>{
    const el=document.getElementById(id);if(el)Array.from(el.options).forEach(o=>o.selected=false);
  });
  document.getElementById('filter-results').style.display='none';
}

async function applyFilters(){
  // Phase 3B: build query from filters and fetch from API
  // For now show mock result
  document.getElementById('filter-results').style.display='block';
  document.getElementById('result-count').textContent='0 records';
  document.getElementById('results-body').innerHTML='<tr><td colspan="9" class="empty-row">No ORB entries found matching your filters. Add entries via the Dashboard tab.</td></tr>';
}

function exportReport(format){
  alert(`${format.toUpperCase()} export coming in Phase 3B.\n\nWill export filtered records in official MARPOL ORB format.`);
}

// ── Tools ─────────────────────────────────────────────────────────────────────
function showGpsFields(source){
  document.getElementById('gps-nmea').style.display=source==='nmea'?'block':'none';
  document.getElementById('gps-api-url').style.display=source==='api'?'block':'none';
}

function saveGpsConfig(){
  const source=document.getElementById('gps-source').value;
  gpsConfig.source=source;
  showToolLog('gps-status','GPS configuration saved','success');
}

function testGps(){showToolLog('gps-status','Testing GPS connection...','info');}

function saveEmailConfig(){showToolLog('email-status','Email configuration saved. Test email will verify connection.','success');}

function testEmail(){showToolLog('email-status','Sending test email...','info');}

function saveSchedules(){showToast('Schedules saved successfully','success');}

async function runBackup(){
  showToolLog('backup-log','Creating encrypted database backup...','info');
  setTimeout(()=>showToolLog('backup-log','Backup complete. Coming in Phase 3C.','success'),1500);
}

async function runIntegrityCheck(){
  const el=document.getElementById('integrity-result');
  el.className='tool-log visible';
  el.style.color='#888';
  el.textContent='Checking audit chain integrity...';
  setTimeout(()=>{el.style.color='#27ae60';el.textContent='Integrity check coming in Phase 3D. Audit DB is append-only and hash-chained.';},1200);
}

function showToolLog(id, msg, type){
  const el=document.getElementById(id);
  if(!el)return;
  el.className='tool-log visible';
  el.style.color=type==='success'?'#27ae60':type==='error'?'#e74c3c':'#666';
  el.textContent=msg;
}

// ── Toast Notification ────────────────────────────────────────────────────────
function showToast(msg, type='success'){
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:20px;right:20px;padding:10px 18px;border-radius:8px;font-size:.85rem;font-weight:500;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.2);
    background:${type==='success'?'#27ae60':type==='warning'?'#f39c12':'#e74c3c'};color:white`;
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function showSetupSection(name){
  ['vessel','users','tanks','alarms','system','audit'].forEach(s=>{
    const el=document.getElementById(`setup-${s}`);if(el)el.style.display=s===name?'block':'none';
  });
  document.querySelectorAll('.setup-nav-item').forEach(el=>el.classList.remove('active'));
  const idx={vessel:0,users:1,tanks:2,alarms:3,system:4,audit:5}[name]??0;
  document.querySelectorAll('.setup-nav-item')[idx]?.classList.add('active');
  if(name==='vessel')loadSetupVessel();
  if(name==='users') loadSetupUsers();
  if(name==='tanks') loadSetupTanks();
  if(name==='alarms')loadSetupAlarms();
  if(name==='system')loadSetupSystem();
  if(name==='audit') loadSetupAudit();
}

async function loadSetupVessel(){
  const res=await req('GET','/vessel/');let v=null;
  if(res&&res.ok)v=await res.json();
  const isAdmin=currentUser.role==='admin';const dis=isAdmin?'':'disabled';
  const types=[['passenger','Passenger Ship'],['bulk_carrier','Bulk Carrier'],['general_cargo','General Cargo'],
    ['container','Container Ship'],['oil_tanker','Oil Tanker'],['product_tanker','Product Tanker'],
    ['chemical_tanker','Chemical Tanker'],['oil_barge','Oil Barge'],['other','Other']];
  document.getElementById('setup-vessel').innerHTML=`<div class="form-card">
    <div class="form-card-header"><h2>Vessel Particulars</h2>${v?'<span class="badge badge-green">Configured</span>':'<span class="badge badge-orange">Not Configured</span>'}</div>
    ${v?`<div class="alert alert-info" style="margin-bottom:14px">ORB Mode: <strong>${v.orb_mode_label}</strong>${v.requires_part2?' — Part II required':' — Part I only'}</div>`:''}
    <div class="form-grid-2">
      <div class="form-group"><label>Vessel Name *</label><input id="v-name" value="${v?.name||''}" ${dis} placeholder="Vessel name"></div>
      <div class="form-group"><label>IMO Number *</label><input id="v-imo" value="${v?.imo_number||''}" ${v?'disabled':dis} placeholder="IMO number"></div>
      <div class="form-group"><label>MMSI</label><input id="v-mmsi" value="${v?.mmsi||''}" ${dis}></div>
      <div class="form-group"><label>Call Sign</label><input id="v-call" value="${v?.call_sign||''}" ${dis}></div>
      <div class="form-group"><label>Flag State *</label><input id="v-flag" value="${v?.flag_state||''}" ${dis}></div>
      <div class="form-group"><label>Vessel Type * (sets ORB mode)</label>
        <select id="v-type" ${dis} onchange="updateOrbPreview(this.value)">
          ${types.map(([val,lbl])=>`<option value="${val}" ${v?.vessel_type===val?'selected':''}>${lbl}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Gross Tonnage</label><input id="v-gt" value="${v?.gross_tonnage||''}" ${dis}></div>
      <div class="form-group"><label>Deadweight (T)</label><input id="v-dwt" value="${v?.deadweight||''}" ${dis}></div>
      <div class="form-group"><label>Year Built</label><input id="v-year" value="${v?.year_built||''}" ${dis}></div>
      <div class="form-group"><label>Owner</label><input id="v-owner" value="${v?.owner||''}" ${dis}></div>
      <div class="form-group"><label>Operator</label><input id="v-oper" value="${v?.operator||''}" ${dis}></div>
      <div class="form-group"><label>ORB Mode (auto-assigned)</label>
        <input id="v-mode-disp" value="${v?.orb_mode_label||'Set by vessel type'}" disabled style="background:#f0f4f8;color:#555"></div>
    </div>
    <div id="vessel-msg"></div>
    ${isAdmin?`<div class="form-actions-outer"><button class="btn btn-primary" onclick="saveVessel('${v?.id||''}')">Save Vessel</button></div>`:'<p class="perm-note">Only Admin can edit vessel details.</p>'}
  </div>`;
}

function updateOrbPreview(type){
  const tankers=['oil_tanker','product_tanker','chemical_tanker','oil_barge'];
  const el=document.getElementById('v-mode-disp');
  if(el)el.value=tankers.includes(type)?'Part I + Part II — Tanker Operations':'Part I — Machinery Space Only';
}

async function saveVessel(vid){
  const data={name:document.getElementById('v-name').value,imo_number:document.getElementById('v-imo').value,
    mmsi:document.getElementById('v-mmsi').value||null,call_sign:document.getElementById('v-call').value||null,
    flag_state:document.getElementById('v-flag').value,vessel_type:document.getElementById('v-type').value,
    gross_tonnage:document.getElementById('v-gt').value||null,deadweight:document.getElementById('v-dwt').value||null,
    year_built:document.getElementById('v-year').value||null,owner:document.getElementById('v-owner').value||null,
    operator:document.getElementById('v-oper').value||null};
  const res=await req(vid?'PUT':'POST',vid?`/vessel/${vid}`:'/vessel/',data);
  const msg=document.getElementById('vessel-msg');
  if(res&&res.ok){msg.innerHTML='<div class="alert alert-success">Vessel saved</div>';await loadVessel();setTimeout(()=>loadSetupVessel(),800);}
  else{const e=await res?.json();msg.innerHTML=`<div class="alert alert-error">${e?.detail||'Save failed'}</div>`;}
}

async function loadSetupUsers(){
  const res=await req('GET','/users/');if(!res||!res.ok)return;
  const users=await res.json();const isAdmin=currentUser.role==='admin';
  document.getElementById('setup-users').innerHTML=`<div class="form-card">
    <div class="section-actions"><h2>Users &amp; Crew (${users.length})</h2>
      ${isAdmin?'<button class="btn btn-primary btn-sm" onclick="showUserModal(null)">+ Add User</button>':''}
    </div>
    <div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Rank</th><th>Certificate</th><th>Status</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
      <tbody>${users.map(u=>`<tr>
        <td><strong>${u.full_name}</strong></td><td><code>${u.username}</code></td>
        <td><span class="badge badge-blue">${u.role.replace(/_/g,' ')}</span></td>
        <td>${u.rank||'-'}</td><td>${u.certificate_number||'-'}</td>
        <td>${u.is_active?'<span class="badge badge-green">Active</span>':'<span class="badge badge-red">Inactive</span>'}</td>
        ${isAdmin?`<td style="display:flex;gap:4px">
          <button class="btn btn-sm btn-secondary" onclick='showUserModal(${JSON.stringify(u)})'>Edit</button>
          <button class="btn btn-sm btn-secondary" onclick="showPwdModal('${u.id}','${u.username}')">Pwd</button>
        </td>`:''}
      </tr>`).join('')}</tbody>
    </table></div></div>`;
}

async function loadSetupTanks(){
  const [tRes,vRes]=await Promise.all([req('GET','/tanks/'),req('GET','/vessel/')]);
  const tanks=tRes&&tRes.ok?await tRes.json():[];
  const vessel=vRes&&vRes.ok?await vRes.json():null;
  const isAdmin=currentUser.role==='admin';
  const groups={};TYPE_ORDER.forEach(t=>groups[t]=[]);
  tanks.forEach(t=>{const k=t.tank_type in groups?t.tank_type:'other';groups[k].push(t);});
  let html=`<div class="form-card"><div class="section-actions">
    <h2>Tanks (${tanks.length} — ${Math.round(tanks.reduce((s,t)=>s+t.capacity_m3,0))} m³)</h2>
    ${isAdmin&&vessel?`<button class="btn btn-primary btn-sm" onclick="showTankModal('${vessel.id}')">+ Add Tank</button>`:''}
  </div>`;
  TYPE_ORDER.forEach(type=>{
    const grp=groups[type];if(!grp.length)return;
    const cap=grp.reduce((s,t)=>s+t.capacity_m3,0);
    html+=`<div class="tank-group-label">${TANK_LABELS[type]||type} — ${grp.length} — ${cap.toFixed(0)} m³</div>
    <div style="overflow-x:auto"><table class="data-table" style="margin-bottom:8px">
      <thead><tr><th>Name</th><th>Capacity m³</th><th>Position</th><th>Frames</th><th>Ext. ID</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
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

async function loadSetupAlarms(){
  const res=await req('GET','/tanks/');
  const tanks=res&&res.ok?await res.json():[];
  const isAdmin=currentUser.role==='admin';
  document.getElementById('setup-alarms').innerHTML=`<div class="form-card">
    <div class="form-card-header"><h2>Par Levels &amp; Alarms</h2>
      ${isAdmin?'<button class="btn btn-primary btn-sm" onclick="saveAlarms()">Save Alarms</button>':''}
    </div>
    <p style="color:#888;font-size:.82rem;margin-bottom:14px">
      Set high and low par levels for each tank. The system will show an alarm when the level is breached.
      High alarms prevent overfilling. Low alarms alert when a tank is running low.
    </p>
    <div style="overflow-x:auto"><table class="alarm-table">
      <thead><tr><th>Tank</th><th>Type</th><th>Capacity m³</th><th>Current %</th><th>High % alarm</th><th>Low % alarm</th><th>Enabled</th></tr></thead>
      <tbody>${tanks.map(t=>`<tr>
        <td><strong>${t.name}</strong></td>
        <td>${TANK_LABELS[t.tank_type]||t.tank_type}</td>
        <td>${t.capacity_m3.toFixed(0)}</td>
        <td><span class="${(t.fill_pct||0)>=(t.alarm_high_pct||101)?'alarm-tag alarm-tag-high':(t.fill_pct||0)<=(t.alarm_low_pct||-1)?'alarm-tag alarm-tag-low':''}">${(t.fill_pct||0).toFixed(1)}%</span></td>
        <td><input type="number" id="ah-${t.id}" value="${t.alarm_high_pct||90}" min="50" max="100" ${isAdmin?'':'disabled'}></td>
        <td><input type="number" id="al-${t.id}" value="${t.alarm_low_pct||10}" min="0" max="50" ${isAdmin?'':'disabled'}></td>
        <td><input type="checkbox" id="ae-${t.id}" ${t.alarm_enabled?'checked':''} ${isAdmin?'':'disabled'}></td>
      </tr>`).join('')}
      </tbody>
    </table></div>
  </div>`;
}

async function saveAlarms(){
  const res=await req('GET','/tanks/');
  const tanks=res&&res.ok?await res.json():[];
  for(const t of tanks){
    const hi=parseFloat(document.getElementById(`ah-${t.id}`)?.value||90);
    const lo=parseFloat(document.getElementById(`al-${t.id}`)?.value||10);
    const en=document.getElementById(`ae-${t.id}`)?.checked||false;
    await req('PUT',`/tanks/${t.id}`,{alarm_high_pct:hi,alarm_low_pct:lo,alarm_enabled:en});
  }
  await loadTanks();
  showToast('Alarm levels saved successfully','success');
  loadSetupAlarms();
}

async function loadSetupSystem(){
  const [uRes,tRes]=await Promise.all([req('GET','/users/'),req('GET','/tanks/')]);
  const users=uRes&&uRes.ok?await uRes.json():[];
  const tanks=tRes&&tRes.ok?await tRes.json():[];
  const modeIsShip=appInfo?.mode==='ship';
  const isAdmin=currentUser.role==='admin';
  document.getElementById('setup-system').innerHTML=`<div class="form-card">
    <div class="form-card-header"><h2>System Information</h2></div>
    <div class="system-stats">
      <div class="stat-card"><div class="stat-val">${tanks.length}</div><div class="stat-lbl">Tanks</div></div>
      <div class="stat-card"><div class="stat-val">${Math.round(tanks.reduce((s,t)=>s+t.capacity_m3,0))}</div><div class="stat-lbl">Total Cap m³</div></div>
      <div class="stat-card"><div class="stat-val">${users.length}</div><div class="stat-lbl">Users</div></div>
      <div class="stat-card"><div class="stat-val">0</div><div class="stat-lbl">ORB Entries</div></div>
    </div>
    <div style="font-size:.8rem;color:#888;margin-bottom:16px">Version: ${appInfo?.app_version||'1.0.0'} &nbsp;|&nbsp; Mode: ${appInfo?.mode_label||'DORB-Ship'}</div>
  </div>
  <div class="form-card">
    <div class="form-card-header"><h2>Operational Mode</h2></div>
    <p style="color:#666;font-size:.85rem;margin-bottom:16px">Each mode uses its own separate database. A valid license key is required to switch.</p>
    <div class="mode-cards">
      <div class="mode-card ${modeIsShip?'active-mode':''}">
        <span class="badge ${modeIsShip?'badge-green':'badge-grey'} mode-active-badge">${modeIsShip?'Active':''}</span>
        <h3>&#9875; DORB-Ship</h3>
        <p>Single vessel onboard operation. Officers enter ORB records in real time.</p>
        <p style="margin-top:8px;font-size:.75rem;color:#aaa">DB: pyorb_ship</p>
      </div>
      <div class="mode-card ${!modeIsShip?'active-mode':''}">
        <span class="badge ${!modeIsShip?'badge-purple':'badge-grey'} mode-active-badge">${!modeIsShip?'Active':''}</span>
        <h3>&#127760; DORB-Control</h3>
        <p>Shore office fleet management. Read-only aggregation from multiple vessels.</p>
        <p style="margin-top:8px;font-size:.75rem;color:#aaa">DB: pyorb_control</p>
      </div>
    </div>
    ${isAdmin?`<button class="btn btn-primary" onclick="showModeSwitcher()">Switch to ${modeIsShip?'DORB-Control':'DORB-Ship'}</button>`:'<p class="perm-note">Only Admin can switch modes.</p>'}
  </div>`;
}

async function loadSetupAudit(){
  document.getElementById('setup-audit').innerHTML=`<div class="form-card">
    <div class="form-card-header"><h2>Audit Log</h2><span class="badge badge-blue">Append-only</span></div>
    <p style="color:#888;font-size:.82rem;margin-bottom:14px">
      Every system action is recorded with old/new values, user, IP and timestamp.
      The audit database is append-only with a SHA-256 hash chain for tamper detection.
    </p>
    <table class="data-table">
      <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Table</th><th>Description</th></tr></thead>
      <tbody><tr><td colspan="5" class="empty-row">Audit log viewer coming in Phase 3D</td></tr></tbody>
    </table>
  </div>`;
}

// ── Mode Switching ────────────────────────────────────────────────────────────
function showModeSwitcher(){
  if(!appInfo)return;
  const isShip=appInfo.mode==='ship';
  const target=isShip?'control':'ship';
  const label=isShip?'DORB-Control':'DORB-Ship';
  const prefix=isShip?'CTRL-':'SHIP-';
  openModal(`<h2>Switch to ${label}</h2>
    <div class="alert alert-info" style="margin-bottom:14px">
      ${isShip?'Switching to DORB-Control connects to the fleet management database.':'Switching to DORB-Ship connects to the vessel onboard database.'}
      Each mode uses its own separate database.
    </div>
    <div class="form-group"><label>License Key for ${label} *</label>
      <input id="license-key" placeholder="${prefix}XXXX-XXXX-XXXX-XXXX" style="font-family:monospace">
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmModeSwitch('${target}')">Activate ${label}</button>
    </div>`);
}

async function confirmModeSwitch(targetMode){
  const key=document.getElementById('license-key').value.trim();
  if(!key){showModalAlert('License key is required');return;}
  const res=await req('POST','/api/mode/switch',{target_mode:targetMode,license_key:key});
  if(res&&res.ok){
    closeModal();
    document.body.insertAdjacentHTML('beforeend',`<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999">
      <div style="background:#fff;border-radius:12px;padding:2rem;text-align:center;max-width:380px">
        <div style="font-size:2.5rem;margin-bottom:1rem">&#10003;</div>
        <h2 style="color:#1a3a5c;margin-bottom:.5rem">Mode Switched</h2>
        <p style="color:#666">Reloading in 3 seconds...</p>
      </div></div>`);
    setTimeout(()=>window.location.reload(),3000);
  }else{const e=await res?.json();showModalAlert(e?.detail||'Mode switch failed');}
}

// ── User Modal ────────────────────────────────────────────────────────────────
function showUserModal(user){
  const roles=['admin','chief_engineer','second_engineer','third_engineer','officer','master','shore_office','port_authority','viewer'];
  const isEdit=!!user;
  openModal(`<h2>${isEdit?'Edit User':'Add User'}</h2>
    <div class="form-grid-2">
      <div class="form-group"><label>Full Name *</label><input id="u-name" value="${user?.full_name||''}" placeholder="Full name"></div>
      <div class="form-group"><label>Username *</label><input id="u-username" value="${user?.username||''}" ${isEdit?'disabled':''} placeholder="username"></div>
      ${!isEdit?'<div class="form-group"><label>Password *</label><input type="password" id="u-password" placeholder="Password"></div>':''}
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

async function saveUser(uid){
  const data={full_name:document.getElementById('u-name').value,role:document.getElementById('u-role').value,
    rank:document.getElementById('u-rank').value||null,email:document.getElementById('u-email').value||null,
    certificate_number:document.getElementById('u-cert').value||null};
  if(uid){const a=document.getElementById('u-active');if(a)data.is_active=a.value==='true';}
  else{data.username=document.getElementById('u-username').value;data.password=document.getElementById('u-password').value;}
  const res=await req(uid?'PUT':'POST',uid?`/users/${uid}`:'/users/',data);
  if(res&&res.ok){closeModal();loadSetupUsers();}
  else{const e=await res?.json();showModalAlert(e?.detail||'Failed');}
}

function showPwdModal(uid,username){
  openModal(`<h2>Change Password</h2><p style="color:#888;margin-bottom:14px">User: <strong>${username}</strong></p>
    <div class="form-group"><label>New Password *</label><input type="password" id="new-pwd" placeholder="Min 6 characters"></div>
    <div class="form-group"><label>Confirm *</label><input type="password" id="conf-pwd" placeholder="Repeat password"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePwd('${uid}')">Change Password</button>
    </div>`);
}
async function savePwd(uid){
  const p=document.getElementById('new-pwd').value,c=document.getElementById('conf-pwd').value;
  if(p!==c){showModalAlert('Passwords do not match');return;}
  if(p.length<6){showModalAlert('Minimum 6 characters');return;}
  const res=await req('PUT',`/users/${uid}/password`,{new_password:p});
  if(res&&res.ok){closeModal();showToast('Password changed','success');}
  else{const e=await res?.json();showModalAlert(e?.detail||'Failed');}
}

function showTankModal(vesselId){
  openModal(`<h2>Add Tank</h2>
    <div class="form-grid-2">
      <div class="form-group"><label>Tank Name *</label><input id="t-name" placeholder="e.g. HFO Tank Port FWD"></div>
      <div class="form-group"><label>Tank Type *</label><select id="t-type">${TYPE_ORDER.map(t=>`<option value="${t}">${TANK_LABELS[t]||t}</option>`).join('')}</select></div>
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

async function saveTank(vid){
  const data={vessel_id:vid,name:document.getElementById('t-name').value,tank_type:document.getElementById('t-type').value,
    capacity_m3:parseFloat(document.getElementById('t-cap').value),position:document.getElementById('t-pos').value||null,
    frame_from:document.getElementById('t-ff').value||null,frame_to:document.getElementById('t-ft').value||null,
    external_system_id:document.getElementById('t-ext').value||null};
  if(!data.name||!data.capacity_m3){showModalAlert('Name and capacity required');return;}
  const res=await req('POST','/tanks/',data);
  if(res&&res.ok){closeModal();await loadTanks();loadSetupTanks();}
  else{const e=await res?.json();showModalAlert(e?.detail||'Failed');}
}

async function removeTank(id,name){
  if(!confirm(`Remove tank "${name}"?`))return;
  const res=await req('DELETE',`/tanks/${id}`);
  if(res&&res.ok){await loadTanks();loadSetupTanks();}
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(html){closeModal();document.getElementById('modal-box').innerHTML=html;document.getElementById('modal-overlay').style.display='flex';}
function closeModal(){document.getElementById('modal-overlay').style.display='none';}
function handleOverlay(e){if(e.target.id==='modal-overlay')closeModal();}
function showModalAlert(msg){let a=document.getElementById('modal-alert');if(!a){a=document.createElement('div');a.id='modal-alert';a.className='alert alert-error';document.getElementById('modal-box').prepend(a);}a.textContent=msg;}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.getElementById('login-screen')?.style.display!=='none')login();
  if(e.key==='Escape')closeModal();
});
loadAppInfo();
if(token&&currentUser)initApp();
