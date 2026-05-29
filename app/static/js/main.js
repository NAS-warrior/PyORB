/* ─── DORB main.js ─────────────────────────────────────────────────────── */
const API='/api';
let token=localStorage.getItem('pyorb_token');
let currentUser=JSON.parse(localStorage.getItem('pyorb_user')||'null');
let vesselData=null,tanksData=[],appInfo=null,usersData=[];
let selectedTank=null,tankChart=null;
let gpsSource='manual';

/* ── colour maps ─────────────────────────────────────────────────────────── */
const GF={fuel_oil:'gf-hfo',diesel_oil:'gf-mgo',lubricating_oil:'gf-lo',bilge:'gf-bilge',slop:'gf-slop',ballast:'gf-ballast',cargo:'gf-cargo',fresh_water:'gf-fw',other:'gf-other'};
const GC={fuel_oil:'#1a5fa5',diesel_oil:'#1a9e75',lubricating_oil:'#b87515',bilge:'#d85a30',slop:'#8b3010',ballast:'#5346b7',cargo:'#2d6e0f',fresh_water:'#0b6e56',other:'#5e5a58'};
const TL={fuel_oil:'Heavy Fuel Oil',diesel_oil:'Diesel / MGO',lubricating_oil:'Lubricating Oil',bilge:'Bilge',slop:'Slop',ballast:'Ballast',cargo:'Cargo',fresh_water:'Fresh Water',other:'Other'};
const TO=['fuel_oil','diesel_oil','lubricating_oil','bilge','slop','ballast','cargo','fresh_water','other'];

/* ── Operation definitions ───────────────────────────────────────────────── */
/* Each operation has:
   id, label, marpol (code), part (1|2|both), tanks (applicable tank types),
   needs_qty, needs_to_tank, needs_ppm, needs_grade, needs_remarks_mandatory,
   description
*/
const OPS=[
  // ── Part I ──────────────────────────────────────────────────────────────
  {id:'bunker',     label:'Bunkering',              icon:'&#9981;', marpol:'H', part:1,
   tanks:['fuel_oil','diesel_oil','lubricating_oil'],
   needs_qty:true, needs_grade:true,
   desc:'Loading fuel from a bunker barge or shore facility. Record grade, quantity (m³ and MT), density, supplier and receiving tank.'},
  {id:'load_fo',    label:'Load to Tank',           icon:'&#8593;', marpol:'H', part:1,
   tanks:['fuel_oil','diesel_oil','lubricating_oil'],
   needs_qty:true,
   desc:'Loading fuel or lubricating oil into a tank from another source. Record grade and quantity.'},
  {id:'discharge_fo',label:'Discharge from Tank',  icon:'&#8595;', marpol:'C', part:1,
   tanks:['fuel_oil','diesel_oil','lubricating_oil','slop'],
   needs_qty:true,
   desc:'Discharging fuel or oil from tank to reception facility or other vessel. State quantity and method.'},
  {id:'transfer',   label:'Tank-to-Tank Transfer',  icon:'&#8646;', marpol:'I', part:1,
   tanks:['fuel_oil','diesel_oil','lubricating_oil','slop','bilge'],
   needs_qty:true, needs_to_tank:true,
   desc:'Internal transfer between two tanks onboard. Record from tank, to tank and quantity transferred (m³).'},
  {id:'ballast_fo', label:'Ballast FO Tank',        icon:'&#8681;', marpol:'A', part:1,
   tanks:['fuel_oil','ballast'],
   needs_qty:true,
   desc:'Ballasting of fuel oil tanks. State tank identity, position and quantity of water pumped in (m³).'},
  {id:'clean_fo',   label:'Clean FO Tank',          icon:'&#9999;', marpol:'B', part:1,
   tanks:['fuel_oil'],
   needs_qty:false,
   desc:'Cleaning of fuel oil tanks. State tank identity and method of cleaning used.'},
  {id:'discharge_ballast',label:'Discharge Dirty Ballast',icon:'&#9660;',marpol:'C',part:1,
   tanks:['fuel_oil','ballast','slop'],
   needs_qty:true,
   desc:'Discharge of dirty ballast or cleaning water from fuel oil tanks. State method and quantity (m³).'},
  {id:'clean_bilge',label:'Clean Bilge',            icon:'&#9999;', marpol:'D', part:1,
   tanks:['bilge'],
   needs_qty:true,
   desc:'Cleaning of bilge holding tanks. State quantity of bilge water, position and method used.'},
  {id:'discharge_bilge',label:'Discharge Bilge',    icon:'&#9660;', marpol:'E', part:1,
   tanks:['bilge','slop'],
   needs_qty:true, needs_ppm:true,
   desc:'Discharge of bilge water overboard via OWS or to reception facility. State position, OWS rate (m³/h) and PPM reading from ODM. PPM is mandatory.'},
  {id:'ows_check',  label:'OWS / ODM Condition',    icon:'&#128268;',marpol:'F',part:1,
   tanks:[],
   needs_qty:false,
   desc:'Record condition of the Oil Water Separator and Oil Discharge Monitor. State any malfunction, bypass use or repairs carried out.'},
  {id:'accidental', label:'Accidental Discharge',   icon:'&#9888;', marpol:'G', part:1,
   tanks:['__any__'],
   needs_qty:true, needs_remarks_mandatory:true,
   desc:'Accidental or exceptional discharge of oil or oily mixture. State time, position, estimated quantity, type, circumstances and corrective action. REMARKS ARE MANDATORY.'},
  {id:'additional', label:'Additional / Remarks',   icon:'&#128221;',marpol:'I',part:1,
   tanks:['__any__'],
   needs_qty:false,
   desc:'Additional operational procedures or general remarks required by MARPOL Annex I.'},

  // ── Part II (tankers only) ───────────────────────────────────────────────
  {id:'p2_load',    label:'Load Cargo',             icon:'&#8593;', marpol:'A', part:2,
   tanks:['cargo'],
   needs_qty:true, needs_grade:true,
   desc:'Loading of oil cargo. State port, tank identity, type of cargo and quantity loaded (m³).'},
  {id:'p2_transfer',label:'Transfer Cargo',         icon:'&#8646;', marpol:'B', part:2,
   tanks:['cargo'],
   needs_qty:true, needs_to_tank:true,
   desc:'Internal transfer of oil cargo between cargo tanks during voyage. State from/to tanks and quantity (m³).'},
  {id:'p2_discharge',label:'Discharge Cargo',       icon:'&#8595;', marpol:'C', part:2,
   tanks:['cargo'],
   needs_qty:true,
   desc:'Unloading of oil cargo. State port, tank identity, quantity discharged and quantity remaining onboard (m³).'},
  {id:'p2_ballast', label:'Ballast Cargo Tank',     icon:'&#8681;', marpol:'D', part:2,
   tanks:['cargo','ballast'],
   needs_qty:true,
   desc:'Ballasting of cargo tanks or dedicated clean ballast tanks. State tank identity, position and quantity (m³).'},
  {id:'p2_clean',   label:'Clean Cargo Tank',       icon:'&#9999;', marpol:'E', part:2,
   tanks:['cargo'],
   needs_qty:false,
   desc:'Cleaning of cargo tanks including crude oil washing. State tanks, method and quantity of cleaning water.'},
  {id:'p2_disc_ballast',label:'Discharge Ballast',  icon:'&#9660;', marpol:'F', part:2,
   tanks:['cargo','ballast','slop'],
   needs_qty:true, needs_ppm:true,
   desc:'Discharge of ballast water or cleaning water from cargo tanks. State position, quantity (m³) and PPM at discharge.'},
  {id:'p2_accidental',label:'Accidental Discharge', icon:'&#9888;', marpol:'G', part:2,
   tanks:['__any__'],
   needs_qty:true, needs_remarks_mandatory:true,
   desc:'Accidental discharge of oil cargo or oily water. State time, position, quantity, type, circumstances and action taken. REMARKS MANDATORY.'},
];

function opsForTank(tankType, part2allowed){
  return OPS.filter(op=>{
    if(op.part===2&&!part2allowed) return false;
    if(op.tanks.length===0) return true; // equipment ops like OWS
    if(op.tanks.includes('__any__')) return true;
    return op.tanks.includes(tankType);
  });
}

/* ── App init ────────────────────────────────────────────────────────────── */
async function loadAppInfo(){
  try{const r=await fetch('/api/appinfo');if(r.ok){appInfo=await r.json();renderModeBar();}}catch(e){}
}
function renderModeBar(){
  if(!appInfo)return;
  const el=document.getElementById('topbar-mode-label');
  if(el){el.textContent=appInfo.mode_label;el.style.background=appInfo.mode==='ship'?'rgba(255,255,255,.13)':'rgba(124,58,237,.35)';}
}

async function login(){
  const u=document.getElementById('username').value.trim();
  const p=document.getElementById('password').value.trim();
  const err=document.getElementById('login-error');
  err.style.display='none';
  if(!u||!p){err.textContent='Enter username and password';err.style.display='block';return;}
  try{
    const fd=new FormData();fd.append('username',u);fd.append('password',p);
    const r=await fetch(`${API}/auth/token`,{method:'POST',body:fd});
    const d=await r.json();
    if(!r.ok){err.textContent=d.detail||'Login failed';err.style.display='block';return;}
    token=d.access_token;currentUser=d.user;
    localStorage.setItem('pyorb_token',token);
    localStorage.setItem('pyorb_user',JSON.stringify(currentUser));
    await boot();
  }catch(e){err.textContent='Connection error';err.style.display='block';}
}

function logout(){
  localStorage.clear();token=null;currentUser=null;vesselData=null;
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
}

async function boot(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('topbar-username').textContent=currentUser.full_name;
  document.getElementById('topbar-role').textContent=currentUser.role.replace(/_/g,' ');
  document.getElementById('topbar-avatar').textContent=currentUser.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  await Promise.all([loadAppInfo(), loadUsers()]);
  // Load saved vessel or first vessel
  const savedVesselId = localStorage.getItem('dorb_vessel_id');
  if (savedVesselId) {
    const r = await req('GET', `/vessel/by-id/${savedVesselId}`);
    if (r && r.ok) {
      vesselData = await r.json();
      activeVesselId = savedVesselId;
      const tr = await req('GET', `/tanks/?vessel_id=${savedVesselId}`);
      if (tr && tr.ok) tanksData = await tr.json();
    }
  }
  if (!vesselData) await loadVessel();
  if (!tanksData.length) await loadTanks();
  // Update topbar
  if (vesselData) {
    document.getElementById('topbar-vesselname').innerHTML = `${vesselData.name} <span style="font-size:.6rem;opacity:.5">&#9660;</span>`;
    document.getElementById('topbar-vesselinfo').textContent = `IMO ${vesselData.imo_number} | ${vesselData.flag_state} | ${vesselData.call_sign||'-'}`;
    document.getElementById('topbar-mode').textContent = vesselData.orb_mode_label;
  }
  renderTanks();
  checkAlarms();
  switchTab('main');
  // If no vessel selected, open the selector
  if (!vesselData || !activeVesselId) {
    setTimeout(() => openVesselSelector(), 500);
  }
}

async function req(method,path,body=null){
  const opts={method,headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}};
  if(body)opts.body=JSON.stringify(body);
  const r=await fetch(`${API}${path}`,opts);
  if(r.status===401){logout();return null;}
  return r;
}

async function loadVessel(){
  const r=await req('GET','/vessel/');
  if(r&&r.ok){
    vesselData=await r.json();
    document.getElementById('topbar-vesselname').textContent=vesselData.name;
    document.getElementById('topbar-vesselinfo').textContent=`IMO ${vesselData.imo_number} | ${vesselData.flag_state} | ${vesselData.call_sign||'-'}`;
    document.getElementById('topbar-mode').textContent=vesselData.orb_mode_label;
  }else{
    document.getElementById('topbar-vesselname').textContent='Vessel not configured';
  }
}

async function loadTanks(){
  const vid = activeVesselId || '';
  const url = vid ? `/tanks/?vessel_id=${vid}` : '/tanks/';
  const r=await req('GET', url);
  if(r&&r.ok){tanksData=await r.json();checkAlarms();}
}

async function loadUsers(){
  const r=await req('GET','/users/');
  if(r&&r.ok)usersData=await r.json();
}

function checkAlarms(){
  const alarmed=tanksData.filter(t=>t.alarm_enabled&&((t.fill_pct||0)>=(t.alarm_high_pct||101)||(t.fill_pct||0)<=(t.alarm_low_pct||-1)));
  const bar=document.getElementById('alarm-bar');
  if(alarmed.length){
    bar.innerHTML='<strong>&#128276; TANK ALARMS:</strong> '+alarmed.map(t=>{
      const hi=(t.fill_pct||0)>=(t.alarm_high_pct||101);
      return `${t.name}: ${(t.fill_pct||0).toFixed(1)}% ${hi?'(HIGH)':'(LOW)'}`;
    }).join(' &nbsp;|&nbsp; ');
    bar.style.display='flex';
  }else bar.style.display='none';
}

/* ── Tab nav ─────────────────────────────────────────────────────────────── */
function switchTab(name){
  document.querySelectorAll('.tab-content').forEach(t=>t.style.display='none');
  document.querySelectorAll('.maintab').forEach(t=>t.classList.remove('active'));
  const tc=document.getElementById(`tab-${name}`);
  if(tc){tc.style.display='block';tc.classList.add('active');}
  document.querySelector(`.maintab[data-tab="${name}"]`)?.classList.add('active');
  if(name==='main')renderTanks();
  if(name==='setup')showSetupSection('vessel');
}

/* ── Tank rendering ──────────────────────────────────────────────────────── */
function renderTanks(){
  const filter=document.getElementById('tank-filter')?.value||'';
  const tanks=filter?tanksData.filter(t=>t.tank_type===filter):tanksData;
  const groups={};TO.forEach(t=>groups[t]=[]);
  tanks.forEach(t=>{const k=t.tank_type in groups?t.tank_type:'other';groups[k].push(t);});
  let html='';
  TO.forEach(type=>{
    const grp=groups[type];if(!grp.length)return;
    const cap=grp.reduce((s,t)=>s+t.capacity_m3,0);
    const cur=grp.reduce((s,t)=>s+(t.current_volume_m3||0),0);
    html+=`<div class="tank-group-hdr"><span>${TL[type]||type} &mdash; ${grp.length}</span><span>${cur.toFixed(0)}/${cap.toFixed(0)} m³</span></div>`;
    html+=`<div class="tank-grid">`;
    grp.forEach(t=>{
      const pct=Math.round(t.fill_pct||0);
      const vol=(t.current_volume_m3||0).toFixed(1);
      const cls=GF[t.tank_type]||'gf-other';
      const alHi=t.alarm_enabled&&pct>=(t.alarm_high_pct||101);
      const alLo=t.alarm_enabled&&pct<=(t.alarm_low_pct||-1);
      const alClass=alHi?'tc-alarm-hi':alLo?'tc-alarm-lo':'';
      const alDot=alHi?'<div class="tc-alarm-dot dot-hi"></div>':alLo?'<div class="tc-alarm-dot dot-lo"></div>':'';
      const selClass=selectedTank?.id===t.id?'tc-selected':'';
      html+=`<div class="tank-card ${selClass} ${alClass}" id="tc-${t.id}" onclick="selectTank('${t.id}')">
        ${alDot}
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
  document.getElementById('tanks-panel').innerHTML=html||'<p style="color:#b0b8c8;padding:10px">No tanks configured</p>';
}

/* ── Tank select ─────────────────────────────────────────────────────────── */
async function selectTank(id){
  selectedTank=tanksData.find(t=>t.id===id);
  if(!selectedTank)return;
  document.querySelectorAll('.tank-card').forEach(c=>c.classList.remove('tc-selected'));
  document.getElementById(`tc-${id}`)?.classList.add('tc-selected');

  // Fetch history & entries in parallel
  const [hRes,eRes]=await Promise.all([
    req('GET',`/orb/tank/${id}/history?limit=30`),
    req('GET',`/orb/part1?tank_id=${id}&limit=10`)
  ]);
  const hist=hRes&&hRes.ok?await hRes.json():null;
  const entries=eRes&&eRes.ok?await eRes.json():[];
  buildRightPanel(selectedTank,hist,entries);
}

/* ── Right panel ─────────────────────────────────────────────────────────── */
function buildRightPanel(tank,hist,entries){
  const pct=Math.round(tank.fill_pct||0);
  const vol=(tank.current_volume_m3||0).toFixed(2);
  const avail=(tank.available_m3!=null?tank.available_m3:tank.capacity_m3).toFixed(2);
  const cap=tank.capacity_m3.toFixed(2);
  const cls=GF[tank.tank_type]||'gf-other';
  const color=GC[tank.tank_type]||'#5e5a58';
  const alHi=tank.alarm_enabled&&pct>=(tank.alarm_high_pct||101);
  const alLo=tank.alarm_enabled&&pct<=(tank.alarm_low_pct||-1);
  const valClass=alHi?'val-hi':alLo?'val-lo':'';

  // Visual tank bar
  const hiPos=tank.alarm_high_pct?`<div class="tank-visual-hi" style="left:${tank.alarm_high_pct}%"></div>`:'';
  const loPos=tank.alarm_low_pct?`<div class="tank-visual-lo" style="left:${tank.alarm_low_pct}%"></div>`:'';

  // Operations for this tank
  const part2=vesselData?.requires_part2||false;
  const ops=opsForTank(tank.tank_type,part2);

  // Group ops by part
  const p1ops=ops.filter(o=>o.part===1);
  const p2ops=ops.filter(o=>o.part===2);

  let html=`<div class="rp">
    <div class="rp-hdr">
      <div class="rp-title">
        <div class="gauge-bar" style="width:10px;height:24px;flex-shrink:0"><div class="gauge-fill ${cls}" style="height:${pct}%"></div></div>
        ${tank.name}
        ${alHi?'<span class="badge badge-red">HIGH</span>':alLo?'<span class="badge badge-orange">LOW</span>':''}
      </div>
      <div class="rp-sub">${TL[tank.tank_type]||tank.tank_type} &nbsp;|&nbsp; Capacity: ${cap} m³ &nbsp;|&nbsp; ${tank.position||''} ${tank.frame_from?`Fr.${tank.frame_from}–${tank.frame_to||''}`:''}</div>
    </div>
    <div class="rp-body">

      <!-- Stat bar -->
      <div class="tank-stat-bar">
        <div class="tank-stat"><div class="tank-stat-val ${valClass}">${pct}%</div><div class="tank-stat-lbl">Fill level</div></div>
        <div class="tank-stat"><div class="tank-stat-val">${vol}</div><div class="tank-stat-lbl">Current m³</div></div>
        <div class="tank-stat"><div class="tank-stat-val">${avail}</div><div class="tank-stat-lbl">Available m³</div></div>
        <div class="tank-stat"><div class="tank-stat-val">${cap}</div><div class="tank-stat-lbl">Capacity m³</div></div>
        ${tank.alarm_enabled?`<div class="tank-stat"><div class="tank-stat-val" style="font-size:.75rem">${tank.alarm_high_pct}% / ${tank.alarm_low_pct}%</div><div class="tank-stat-lbl">H/L alarm</div></div>`:''}
      </div>

      <!-- Visual bar -->
      <div class="tank-visual">
        <div class="tank-visual-fill" style="width:${pct}%;background:${color}"></div>
        ${hiPos}${loPos}
      </div>

      <!-- Volume history chart -->
      <div class="section-hdr"><span>Volume History (last 30 days)</span></div>
      <div class="chart-wrap">
        ${hist&&hist.history&&hist.history.length
          ?`<canvas id="tchart" height="120"></canvas>`
          :`<div class="chart-empty">No history yet — volume tracked after first operation</div>`}
      </div>

      <!-- Recent entries -->
      <div class="section-hdr">
        <span>Recent Operations</span>
        <select class="sel-sm" onchange="reloadEntries('${tank.id}',this.value)">
          <option value="10">Last 10</option><option value="20">Last 20</option><option value="50">Last 50</option>
        </select>
      </div>
      <div style="overflow-x:auto;margin-bottom:14px">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Code</th><th>Operation</th><th>Qty m³</th><th>Officer</th></tr></thead>
          <tbody>${entries.length?entries.map(e=>`<tr>
            <td>${new Date(e.operation_date).toLocaleDateString()}</td>
            <td><span class="badge badge-blue">${e.operation_code}</span></td>
            <td>${e.operation_type||'-'}</td>
            <td>${e.quantity_m3!=null?e.quantity_m3.toFixed(2):'-'}</td>
            <td>${e.officer}</td>
          </tr>`).join(''):`<tr><td colspan="5" class="empty-row">No operations recorded for this tank yet</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Operation selector -->
      <div class="section-hdr"><span>Record Operation</span></div>
      <div class="ops-tabs">
        ${p1ops.map(op=>`
          <button class="ops-tab-btn" id="opbtn-${op.id}" onclick="showOpForm('${op.id}')" title="${op.desc}">
            ${op.icon} ${op.label} <span style="font-size:.65rem;opacity:.7">(${op.marpol})</span>
          </button>`).join('')}
        ${p2ops.length?`<div style="width:100%;height:1px;background:var(--border);margin:4px 0"></div>
          <div style="font-size:.65rem;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;width:100%">Part II — Cargo/Ballast</div>
          ${p2ops.map(op=>`
            <button class="ops-tab-btn op-transfer" id="opbtn-${op.id}" onclick="showOpForm('${op.id}')" title="${op.desc}">
              ${op.icon} ${op.label} <span style="font-size:.65rem;opacity:.7">(${op.marpol})</span>
            </button>`).join('')}`:''}
      </div>

      <!-- Operation forms (one per op, shown on click) -->
      <div id="op-forms">
        ${[...p1ops,...p2ops].map(op=>buildOpForm(op,tank)).join('')}
      </div>

    </div><!-- rp-body -->
  </div><!-- rp -->`;

  document.getElementById('right-panel').innerHTML=html;

  // Draw chart
  if(hist&&hist.history&&hist.history.length){
    setTimeout(()=>{
      const canvas=document.getElementById('tchart');if(!canvas)return;
      if(tankChart){tankChart.destroy();}
      const labels=hist.history.map(h=>new Date(h.date).toLocaleDateString());
      const vols=hist.history.map(h=>h.volume_m3);
      const caps=hist.history.map(()=>tank.capacity_m3);
      tankChart=new Chart(canvas,{
        type:'line',
        data:{labels,datasets:[
          {label:'Volume m³',data:vols,borderColor:color,backgroundColor:color+'22',fill:true,tension:.3,pointRadius:3,pointBackgroundColor:color},
          {label:'Capacity',data:caps,borderColor:'#c0392b',borderDash:[4,4],fill:false,pointRadius:0,borderWidth:1},
        ]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false}},
          scales:{y:{beginAtZero:true,ticks:{font:{size:8}},title:{display:true,text:'m³',font:{size:8}}},
                  x:{ticks:{font:{size:8},maxRotation:0,maxTicksLimit:7}}}}
      });
    },80);
  }

  // Populate officer dropdowns
  setTimeout(()=>populateOfficers(),50);
}

/* ── Build operation form ────────────────────────────────────────────────── */
function buildOpForm(op,tank){
  const canWrite=['admin','chief_engineer','second_engineer','third_engineer','officer'].includes(currentUser.role);
  const now=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  const tank2opts=tanksData.filter(t=>t.id!==tank.id).map(t=>`<option value="${t.id}">${t.name} (${TL[t.tank_type]||t.tank_type})</option>`).join('');

  let fields='';

  // Date + status
  fields+=`<div class="fg-row2">
    <div class="form-group"><label>Date &amp; Time<span class="required-star">*</span></label>
      <input type="datetime-local" id="${op.id}-date" value="${now}"></div>
    <div class="form-group"><label>Ship Status</label>
      <select id="${op.id}-status">
        <option value="unknown">Unknown</option>
        <option value="en_route">En route</option>
        <option value="approaching">Approaching port</option>
        <option value="at_anchor">At anchor</option>
        <option value="in_port">In port / at berth</option>
        <option value="maneuvering">Maneuvering</option>
      </select></div>
  </div>
  <div class="form-group"><label>Port (if in port)</label>
    <input type="text" id="${op.id}-port" placeholder="Port name or anchorage"></div>
  <div class="form-group"><label>Position</label>
    <div class="pos-group">
      <div class="form-group"><label>Latitude</label><input type="text" id="${op.id}-lat" placeholder="e.g. 35.689 N"></div>
      <div class="form-group"><label>Longitude</label><input type="text" id="${op.id}-lon" placeholder="e.g. 14.375 E"></div>
      <button class="btn-icon" onclick="fillGPS('${op.id}')" title="Use GPS">&#128225;</button>
      <button class="btn-icon" onclick="openMapModal('${op.id}')" title="Pick from map">&#127758;</button>
    </div>
  </div>`;

  // Quantity
  if(op.needs_qty){
    fields+=`<div class="fg-row2">
      <div class="form-group"><label>Quantity (m³)<span class="required-star">*</span></label>
        <input type="number" step="0.01" id="${op.id}-qty" placeholder="0.00"
          oninput="validateQty('${op.id}','${tank.id}')"></div>
      ${op.needs_to_tank?`
      <div class="form-group"><label>Transfer To Tank<span class="required-star">*</span></label>
        <select id="${op.id}-to-tank"><option value="">Select destination tank...</option>${tank2opts}</select></div>`
      :`<div class="form-group"></div>`}
    </div>
    <div id="${op.id}-qty-msg"></div>`;
  }

  // Grade (bunkering)
  if(op.needs_grade){
    fields+=`<div class="fg-row2">
      <div class="form-group"><label>Fuel Grade / Type</label>
        <select id="${op.id}-grade">
          <option value="">Select grade...</option>
          <option>HFO (Heavy Fuel Oil)</option>
          <option>VLSFO (Very Low Sulphur FO)</option>
          <option>ULSFO (Ultra Low Sulphur FO)</option>
          <option>MGO (Marine Gas Oil)</option>
          <option>LSMGO (Low Sulphur MGO)</option>
          <option>MDO (Marine Diesel Oil)</option>
          <option>LNG</option>
          <option>Lubricating Oil</option>
        </select></div>
      <div class="form-group"><label>Mass (metric tons)</label>
        <input type="number" step="0.01" id="${op.id}-mass" placeholder="0.00"></div>
    </div>
    <div class="fg-row2">
      <div class="form-group"><label>Density (kg/m³)</label>
        <input type="number" step="0.1" id="${op.id}-density" placeholder="e.g. 991.2"></div>
      <div class="form-group"><label>Bunker Supplier / Barge</label>
        <input type="text" id="${op.id}-supplier" placeholder="Supplier name or barge"></div>
    </div>`;
  }

  // PPM (OWS discharge)
  if(op.needs_ppm){
    fields+=`<div class="fg-row2">
      <div class="form-group"><label>OWS Rate (m³/h)</label>
        <input type="number" step="0.1" id="${op.id}-ows" placeholder="0.0"></div>
      <div class="form-group"><label>Oil Content PPM<span class="required-star">*</span></label>
        <input type="number" step="0.1" id="${op.id}-ppm" placeholder="ODM reading"></div>
    </div>`;
  }

  // Remarks
  const remStar=op.needs_remarks_mandatory?'<span class="required-star">*</span>':'';
  fields+=`<div class="form-group"><label>Remarks ${remStar}</label>
    <textarea id="${op.id}-remarks" rows="2" placeholder="${op.needs_remarks_mandatory?'Required: describe circumstances and action taken':'Additional details, references, certificates...'}">${''}</textarea></div>`;

  // Officer
  fields+=`<div class="form-group"><label>Responsible Officer<span class="required-star">*</span></label>
    <select id="${op.id}-officer" class="op-officer-sel"><option value="">Select officer...</option></select></div>`;

  const noteClass=op.id==='accidental'||op.id==='p2_accidental'?'note-danger':op.needs_ppm?'note-warn':'';

  return `<div class="op-form" id="opform-${op.id}">
    <div class="op-form-title">
      ${op.icon} ${op.label}
      <span class="marpol-ref">MARPOL Code ${op.marpol}</span>
      ${op.part===2?'<span class="badge badge-purple">Part II</span>':'<span class="badge badge-blue">Part I</span>'}
    </div>
    <div class="form-note ${noteClass}">${op.desc}</div>
    <div id="${op.id}-val-err"></div>
    ${fields}
    ${canWrite?`<div class="form-actions">
      <button class="btn btn-secondary" onclick="closeOpForm('${op.id}')">Cancel</button>
      <button class="btn btn-primary" onclick="submitOp('${op.id}','${tank.id}',${op.part},'${op.marpol}',${JSON.stringify(op)})">
        &#10003; Submit ORB Entry
      </button>
    </div>`:'<p class="perm-note">You do not have permission to record operations.</p>'}
  </div>`;
}

function populateOfficers(){
  const writeRoles=['admin','chief_engineer','second_engineer','third_engineer','officer'];
  const officers=usersData.filter(u=>writeRoles.includes(u.role)&&u.is_active);
  document.querySelectorAll('.op-officer-sel').forEach(sel=>{
    sel.innerHTML='<option value="">Select officer...</option>'+
      officers.map(u=>`<option value="${u.id}" ${u.id===currentUser.id?'selected':''}>${u.full_name} (${u.rank||u.role.replace(/_/g,' ')})</option>`).join('');
  });
}

function showOpForm(opId){
  // Hide all forms
  document.querySelectorAll('.op-form').forEach(f=>f.classList.remove('active'));
  document.querySelectorAll('.ops-tab-btn').forEach(b=>b.classList.remove('op-active'));
  // Show this one
  document.getElementById(`opform-${opId}`)?.classList.add('active');
  document.getElementById(`opbtn-${opId}`)?.classList.add('op-active');
  document.getElementById(`opform-${opId}`)?.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function closeOpForm(opId){
  document.getElementById(`opform-${opId}`)?.classList.remove('active');
  document.getElementById(`opbtn-${opId}`)?.classList.remove('op-active');
}

/* ── Live quantity validation ────────────────────────────────────────────── */
async function validateQty(opId,tankId){
  const qty=parseFloat(document.getElementById(`${opId}-qty`)?.value);
  const msgDiv=document.getElementById(`${opId}-qty-msg`);
  if(!msgDiv||isNaN(qty)||qty<=0){if(msgDiv)msgDiv.innerHTML='';return;}
  const op=OPS.find(o=>o.id===opId);
  if(!op)return;
  const r=await req('POST','/orb/validate',{tank_id:tankId,operation_code:op.marpol,quantity_m3:qty,part:op.part===1?'p1':'p2'});
  if(!r||!r.ok)return;
  const d=await r.json();
  msgDiv.innerHTML=d.errors.map(e=>`<div class="val-error">&#10007; ${e}</div>`).join('')+
                   d.warnings.map(w=>`<div class="val-warn">&#9888; ${w}</div>`).join('');
}

/* ── Submit operation ────────────────────────────────────────────────────── */
async function submitOp(opId,tankId,part,code,op){
  if(typeof op==='string')op=JSON.parse(op);
  const get=id=>{const el=document.getElementById(`${opId}-${id}`);return el?el.value:null;};
  const date=get('date');if(!date){toast('Operation date is required','error');return;}
  const officerId=get('officer');if(!officerId){toast('Select the responsible officer','error');return;}
  if(op.needs_remarks_mandatory&&!get('remarks')?.trim()){toast('Remarks are mandatory for this operation','error');return;}
  if(op.needs_ppm&&!get('ppm')){toast('PPM reading from ODM is required','error');return;}
  const qty=parseFloat(get('qty'))||null;
  const toTankId=get('to-tank')||null;
  if(op.needs_to_tank&&!toTankId){toast('Select destination tank for transfer','error');return;}

  const payload={
    vessel_id:vesselData.id,
    officer_id:officerId,
    operation_code:code,
    operation_type:opId,
    operation_date:date,
    ship_status:get('status')||'unknown',
    position_lat:parseFloat(get('lat'))||null,
    position_lon:parseFloat(get('lon'))||null,
    position_source:gpsSource,
    port_name:get('port')||null,
    tank_id:tankId,
    tank_to_id:toTankId,
    quantity_m3:qty,
    ows_rate:parseFloat(get('ows'))||null,
    oil_content_ppm:parseFloat(get('ppm'))||null,
    bunker_grade:get('grade')||null,
    bunker_mass_mt:parseFloat(get('mass'))||null,
    bunker_density:parseFloat(get('density'))||null,
    bunker_supplier:get('supplier')||null,
    remarks:get('remarks')||null,
  };

  const endpoint=part===2?'/orb/part2':'/orb/part1';
  const r=await req('POST',endpoint,payload);
  if(r&&r.ok){
    toast('ORB entry recorded successfully','success');
    closeOpForm(opId);
    await loadTanks();
    renderTanks();
    await selectTank(tankId);
  }else{
    const err=await r?.json();
    const errDiv=document.getElementById(`${opId}-val-err`);
    if(errDiv)errDiv.innerHTML=`<div class="val-error">&#10007; ${err?.detail||'Submission failed'}</div>`;
    toast(err?.detail||'Submission failed','error');
  }
}

async function reloadEntries(tankId,limit){
  const r=await req('GET',`/orb/part1?tank_id=${tankId}&limit=${limit}`);
  // Quick re-render — just refresh the full panel
  await selectTank(tankId);
}

/* ── GPS ─────────────────────────────────────────────────────────────────── */
function fillGPS(opId){
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat=pos.coords.latitude.toFixed(6);
      const lon=pos.coords.longitude.toFixed(6);
      const latEl=document.getElementById(`${opId}-lat`);
      const lonEl=document.getElementById(`${opId}-lon`);
      if(latEl)latEl.value=lat;
      if(lonEl)lonEl.value=lon;
      gpsSource='browser_gps';
      toast('Position from browser GPS','success');
    },()=>toast('GPS unavailable — enter manually','warning'));
  }else toast('Browser GPS not available','warning');
}

function openMapModal(opId){
  openModal(`<h2>&#127758; Pick Position on Map</h2>
    <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-10,30,40,65&layer=mapnik"
      style="width:100%;height:380px;border:1px solid var(--border);border-radius:6px;margin-bottom:12px"></iframe>
    <div class="fg-row2">
      <div class="form-group"><label>Latitude</label><input id="map-lat" placeholder="e.g. 35.6892 N"></div>
      <div class="form-group"><label>Longitude</label><input id="map-lon" placeholder="e.g. 14.3754 E"></div>
    </div>
    <p style="font-size:.72rem;color:var(--text2);margin-bottom:12px">Enter coordinates manually or right-click the map to copy position</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="applyMapPos('${opId}')">Use Position</button>
    </div>`);
}

function applyMapPos(opId){
  const lat=document.getElementById('map-lat')?.value;
  const lon=document.getElementById('map-lon')?.value;
  if(lat){const el=document.getElementById(`${opId}-lat`);if(el)el.value=lat;}
  if(lon){const el=document.getElementById(`${opId}-lon`);if(el)el.value=lon;}
  gpsSource='map_picker';
  closeModal();
}

/* ── Reports ─────────────────────────────────────────────────────────────── */
function clearFilters(){
  document.querySelectorAll('#tab-reports input,#tab-reports select').forEach(el=>{
    if(el.multiple)Array.from(el.options).forEach(o=>o.selected=false);
    else el.value='';
  });
  document.getElementById('filter-results').style.display='none';
}

async function applyFilters(){
  // Phase 3B: full API query
  document.getElementById('filter-results').style.display='block';
  document.getElementById('result-count').textContent='0 records';
  document.getElementById('results-body').innerHTML='<tr><td colspan="10" class="empty-row">No ORB entries match your filters. Record operations via the Tanks & Operations tab.</td></tr>';
}

function exportReport(fmt){
  toast(`${fmt.toUpperCase()} export coming in Phase 3B`,'info');
}

/* ── Tools ───────────────────────────────────────────────────────────────── */
function showGpsFields(src){
  document.getElementById('gps-nmea-fields').style.display=src==='nmea'?'block':'none';
  document.getElementById('gps-api-fields').style.display=src==='api'?'block':'none';
}
function saveGpsConfig(){gpsSource=document.getElementById('gps-source').value;toolLog('gps-status','GPS config saved','ok');}
function testGps(){toolLog('gps-status','Testing GPS...','info');}
async function runBackup(){toolLog('backup-log','Creating backup...','info');setTimeout(()=>toolLog('backup-log','Backup complete (Phase 3C)','ok'),1500);}
async function runIntegrityCheck(){toolLog('integrity-result','Checking hash chain...','info');setTimeout(()=>toolLog('integrity-result','Integrity check available in Phase 3D','ok'),1200);}
function notImpl(what){toast(`${what} coming in Phase 3C`,'info');}
function toolLog(id,msg,type){const el=document.getElementById(id);if(!el)return;el.className='tool-log show';el.style.color=type==='ok'?'#27ae60':type==='info'?'#2979b8':'#c0392b';el.textContent=msg;}

/* ── Setup sections ──────────────────────────────────────────────────────── */
function showSetupSection(name){
  ['vessel','users','tanks','alarms','system','audit'].forEach(s=>{
    const el=document.getElementById(`setup-${s}`);if(el)el.style.display=s===name?'block':'none';
  });
  document.querySelectorAll('.setup-tab-btn').forEach(el=>el.classList.remove('active'));
  const idx={vessel:0,users:1,tanks:2,alarms:3,system:4,audit:5}[name]??0;
  document.querySelectorAll('.setup-tab-btn')[idx]?.classList.add('active');
  if(name==='vessel')loadSetupVessel();
  if(name==='users')loadSetupUsers();
  if(name==='tanks')loadSetupTanks();
  if(name==='alarms')loadSetupAlarms();
  if(name==='system')loadSetupSystem();
  if(name==='audit')loadSetupAudit();
}

async function loadSetupVessel(){
  const r=await req('GET','/vessel/');let v=null;if(r&&r.ok)v=await r.json();
  const isAdmin=currentUser.role==='admin';const dis=isAdmin?'':'disabled';
  const types=[['passenger','Passenger Ship'],['bulk_carrier','Bulk Carrier'],['general_cargo','General Cargo'],
    ['container','Container Ship'],['oil_tanker','Oil Tanker'],['product_tanker','Product Tanker'],
    ['chemical_tanker','Chemical Tanker'],['oil_barge','Oil Barge'],['other','Other']];
  document.getElementById('setup-vessel').innerHTML=`<div class="form-card">
    <div class="form-card-header"><h2>Vessel Particulars</h2>${v?'<span class="badge badge-green">Configured</span>':'<span class="badge badge-orange">Not Configured</span>'}</div>
    ${v?`<div class="alert alert-info" style="margin-bottom:12px">ORB Mode: <strong>${v.orb_mode_label}</strong>${v.requires_part2?' — Part II required':' — Part I only'}</div>`:''}
    <div class="form-grid-2">
      <div class="form-group"><label>Vessel Name *</label><input id="v-name" value="${v?.name||''}" ${dis} placeholder="e.g. Marella Explorer 2"></div>
      <div class="form-group"><label>IMO Number *</label><input id="v-imo" value="${v?.imo_number||''}" ${v?'disabled':dis}></div>
      <div class="form-group"><label>MMSI</label><input id="v-mmsi" value="${v?.mmsi||''}" ${dis}></div>
      <div class="form-group"><label>Call Sign</label><input id="v-call" value="${v?.call_sign||''}" ${dis}></div>
      <div class="form-group"><label>Flag State *</label><input id="v-flag" value="${v?.flag_state||''}" ${dis}></div>
      <div class="form-group"><label>Vessel Type *</label><select id="v-type" ${dis} onchange="updateOrbPreview(this.value)">
        ${types.map(([val,lbl])=>`<option value="${val}" ${v?.vessel_type===val?'selected':''}>${lbl}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Gross Tonnage</label><input id="v-gt" value="${v?.gross_tonnage||''}" ${dis}></div>
      <div class="form-group"><label>Deadweight (T)</label><input id="v-dwt" value="${v?.deadweight||''}" ${dis}></div>
      <div class="form-group"><label>Year Built</label><input id="v-year" value="${v?.year_built||''}" ${dis}></div>
      <div class="form-group"><label>Owner</label><input id="v-owner" value="${v?.owner||''}" ${dis}></div>
      <div class="form-group"><label>Operator</label><input id="v-oper" value="${v?.operator||''}" ${dis}></div>
      <div class="form-group"><label>ORB Mode (auto-assigned)</label>
        <input id="v-mode-disp" value="${v?.orb_mode_label||'Set by vessel type'}" disabled style="background:#f4f6f9;color:#6b7a8d"></div>
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
  const d={name:document.getElementById('v-name').value,imo_number:document.getElementById('v-imo').value,
    mmsi:document.getElementById('v-mmsi').value||null,call_sign:document.getElementById('v-call').value||null,
    flag_state:document.getElementById('v-flag').value,vessel_type:document.getElementById('v-type').value,
    gross_tonnage:document.getElementById('v-gt').value||null,deadweight:document.getElementById('v-dwt').value||null,
    year_built:document.getElementById('v-year').value||null,owner:document.getElementById('v-owner').value||null,
    operator:document.getElementById('v-oper').value||null};
  const r=await req(vid?'PUT':'POST',vid?`/vessel/${vid}`:'/vessel/',d);
  const msg=document.getElementById('vessel-msg');
  if(r&&r.ok){msg.innerHTML='<div class="alert alert-success">Saved successfully</div>';await loadVessel();setTimeout(()=>loadSetupVessel(),800);}
  else{const e=await r?.json();msg.innerHTML=`<div class="alert alert-error">${e?.detail||'Save failed'}</div>`;}
}

async function loadSetupUsers(){
  const r=await req('GET','/users/');if(!r||!r.ok)return;
  const users=await r.json();const isAdmin=currentUser.role==='admin';
  document.getElementById('setup-users').innerHTML=`<div class="form-card">
    <div class="section-actions"><h2>Users &amp; Crew (${users.length})</h2>
      ${isAdmin?'<button class="btn btn-primary btn-sm" onclick="showUserModal(null)">+ Add User</button>':''}
    </div>
    <div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Rank</th><th>Certificate</th><th>Status</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
      <tbody>${users.map(u=>`<tr>
        <td><strong>${u.full_name}</strong></td><td><code style="font-size:.75rem">${u.username}</code></td>
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
  const [tR,vR]=await Promise.all([req('GET','/tanks/'),req('GET','/vessel/')]);
  const tanks=tR&&tR.ok?await tR.json():[];
  const vessel=vR&&vR.ok?await vR.json():null;
  const isAdmin=currentUser.role==='admin';
  const groups={};TO.forEach(t=>groups[t]=[]);
  tanks.forEach(t=>{const k=t.tank_type in groups?t.tank_type:'other';groups[k].push(t);});
  let html=`<div class="form-card"><div class="section-actions">
    <h2>Tanks (${tanks.length} — ${Math.round(tanks.reduce((s,t)=>s+t.capacity_m3,0))} m³)</h2>
    ${isAdmin&&vessel?`<button class="btn btn-primary btn-sm" onclick="showTankModal('${vessel.id}')">+ Add Tank</button>`:''}
  </div>`;
  TO.forEach(type=>{
    const grp=groups[type];if(!grp.length)return;
    const cap=grp.reduce((s,t)=>s+t.capacity_m3,0);
    html+=`<div class="tank-group-hdr"><span>${TL[type]||type} — ${grp.length}</span><span>${cap.toFixed(0)} m³</span></div>
    <div style="overflow-x:auto"><table class="data-table" style="margin-bottom:10px">
      <thead><tr><th>Name</th><th>Capacity m³</th><th>Current m³</th><th>Fill %</th><th>Position</th><th>Frames</th>${isAdmin?'<th></th>':''}</tr></thead>
      <tbody>${grp.map(t=>`<tr>
        <td><strong>${t.name}</strong></td><td>${t.capacity_m3.toFixed(2)}</td>
        <td>${(t.current_volume_m3||0).toFixed(2)}</td><td>${(t.fill_pct||0).toFixed(1)}%</td>
        <td>${t.position?`<span class="badge badge-grey">${t.position}</span>`:'-'}</td>
        <td>${t.frame_from||'-'}–${t.frame_to||'-'}</td>
        ${isAdmin?`<td><button class="btn btn-sm btn-danger" onclick="removeTank('${t.id}','${t.name}')">Remove</button></td>`:''}
      </tr>`).join('')}</tbody>
    </table></div>`;
  });
  html+='</div>';
  document.getElementById('setup-tanks').innerHTML=html;
}

async function loadSetupAlarms(){
  const r=await req('GET','/tanks/');const tanks=r&&r.ok?await r.json():[];
  const isAdmin=currentUser.role==='admin';
  document.getElementById('setup-alarms').innerHTML=`<div class="form-card">
    <div class="form-card-header"><h2>Par Levels &amp; Alarms</h2>
      ${isAdmin?'<button class="btn btn-primary btn-sm" onclick="saveAlarms()">Save All</button>':''}
    </div>
    <p style="color:var(--text2);font-size:.8rem;margin-bottom:12px">Set high and low volume thresholds per tank. Alarm appears in the top bar when breached.</p>
    <div style="overflow-x:auto"><table class="alarm-table">
      <thead><tr><th>Tank</th><th>Type</th><th>Capacity m³</th><th>Current %</th><th>High % alarm</th><th>Low % alarm</th><th>Enabled</th></tr></thead>
      <tbody>${tanks.map(t=>`<tr>
        <td><strong>${t.name}</strong></td>
        <td style="font-size:.75rem">${TL[t.tank_type]||t.tank_type}</td>
        <td>${t.capacity_m3.toFixed(0)}</td>
        <td><span class="${(t.fill_pct||0)>=(t.alarm_high_pct||101)?'badge badge-red':(t.fill_pct||0)<=(t.alarm_low_pct||-1)?'badge badge-orange':''}">${(t.fill_pct||0).toFixed(1)}%</span></td>
        <td><input type="number" id="ah-${t.id}" value="${t.alarm_high_pct||90}" min="50" max="100" step="5" ${isAdmin?'':'disabled'}></td>
        <td><input type="number" id="al-${t.id}" value="${t.alarm_low_pct||10}" min="0" max="50" step="5" ${isAdmin?'':'disabled'}></td>
        <td><input type="checkbox" id="ae-${t.id}" ${t.alarm_enabled?'checked':''} ${isAdmin?'':'disabled'}></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

async function saveAlarms(){
  const r=await req('GET','/tanks/');const tanks=r&&r.ok?await r.json():[];
  for(const t of tanks){
    const hi=parseFloat(document.getElementById(`ah-${t.id}`)?.value||90);
    const lo=parseFloat(document.getElementById(`al-${t.id}`)?.value||10);
    const en=document.getElementById(`ae-${t.id}`)?.checked||false;
    await req('PUT',`/tanks/${t.id}`,{alarm_high_pct:hi,alarm_low_pct:lo,alarm_enabled:en});
  }
  await loadTanks();toast('Alarm levels saved','success');loadSetupAlarms();
}

async function loadSetupSystem(){
  const [uR,tR]=await Promise.all([req('GET','/users/'),req('GET','/tanks/')]);
  const users=uR&&uR.ok?await uR.json():[];
  const tanks=tR&&tR.ok?await tR.json():[];
  const modeIsShip=appInfo?.mode==='ship';const isAdmin=currentUser.role==='admin';
  document.getElementById('setup-system').innerHTML=`<div class="form-card">
    <div class="form-card-header"><h2>System Information</h2></div>
    <div class="system-stats">
      <div class="stat-card"><div class="stat-val">${tanks.length}</div><div class="stat-lbl">Tanks</div></div>
      <div class="stat-card"><div class="stat-val">${Math.round(tanks.reduce((s,t)=>s+t.capacity_m3,0))}</div><div class="stat-lbl">Total Cap m³</div></div>
      <div class="stat-card"><div class="stat-val">${users.length}</div><div class="stat-lbl">Users</div></div>
      <div class="stat-card"><div class="stat-val">0</div><div class="stat-lbl">ORB Entries</div></div>
    </div>
    <div style="font-size:.75rem;color:var(--text2)">Version ${appInfo?.app_version||'1.0.0'} &nbsp;|&nbsp; Mode: ${appInfo?.mode_label||'DORB-Ship'}</div>
  </div>
  <div class="form-card">
    <div class="form-card-header"><h2>Operational Mode</h2></div>
    <p style="color:var(--text2);font-size:.82rem;margin-bottom:14px">Each mode uses its own separate database. A valid license key is required to switch.</p>
    <div class="mode-cards">
      <div class="mode-card ${modeIsShip?'active-mode':''}">
        <span class="badge ${modeIsShip?'badge-green':'badge-grey'} mode-active-badge">${modeIsShip?'Active':''}</span>
        <h3>&#9875; DORB-Ship</h3>
        <p>Single vessel onboard operation. Officers enter ORB records in real time.</p>
        <p style="margin-top:8px;font-size:.72rem;color:var(--text2)">DB: pyorb_ship</p>
      </div>
      <div class="mode-card ${!modeIsShip?'active-mode':''}">
        <span class="badge ${!modeIsShip?'badge-purple':'badge-grey'} mode-active-badge">${!modeIsShip?'Active':''}</span>
        <h3>&#127760; DORB-Control</h3>
        <p>Shore office fleet management. Read-only aggregation from multiple vessels.</p>
        <p style="margin-top:8px;font-size:.72rem;color:var(--text2)">DB: pyorb_control</p>
      </div>
    </div>
    ${isAdmin?`<button class="btn btn-primary" onclick="showModeSwitcher()">Switch to ${modeIsShip?'DORB-Control':'DORB-Ship'}</button>`:'<p class="perm-note">Only Admin can switch modes.</p>'}
  </div>`;
}

async function loadSetupAudit(){
  document.getElementById('setup-audit').innerHTML=`<div class="form-card">
    <div class="form-card-header"><h2>Audit Log</h2><span class="badge badge-blue">Append-only</span></div>
    <p style="color:var(--text2);font-size:.8rem;margin-bottom:12px">Every action is recorded with user, timestamp, IP and old/new values. Append-only with SHA-256 hash chain.</p>
    <table class="data-table">
      <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Table</th><th>Description</th></tr></thead>
      <tbody><tr><td colspan="5" class="empty-row">Audit log viewer coming in Phase 3D</td></tr></tbody>
    </table></div>`;
}

/* ── Mode switch ─────────────────────────────────────────────────────────── */
function showModeSwitcher(){
  if(!appInfo)return;
  const isShip=appInfo.mode==='ship';const target=isShip?'control':'ship';
  const label=isShip?'DORB-Control':'DORB-Ship';const prefix=isShip?'CTRL-':'SHIP-';
  openModal(`<h2>Switch to ${label}</h2>
    <div class="alert alert-info" style="margin-bottom:12px">
      ${isShip?'Switching to DORB-Control connects to the fleet management database.':'Switching to DORB-Ship connects to the vessel onboard database.'}
      Each mode uses its own separate database. Current data is not affected.
    </div>
    <div class="form-group"><label>License Key for ${label} *</label>
      <input id="lic-key" placeholder="${prefix}XXXX-XXXX-XXXX-XXXX" style="font-family:monospace"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmSwitch('${target}')">Activate ${label}</button>
    </div>`);
}

async function confirmSwitch(targetMode){
  const key=document.getElementById('lic-key')?.value.trim();
  if(!key){showModalAlert('License key is required');return;}
  const r=await req('POST','/api/mode/switch',{target_mode:targetMode,license_key:key});
  if(r&&r.ok){
    closeModal();
    document.body.insertAdjacentHTML('beforeend',`<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999">
      <div style="background:#fff;border-radius:12px;padding:2rem;text-align:center">
        <div style="font-size:2.5rem">&#10003;</div>
        <h2 style="color:var(--primary);margin:.5rem 0">Mode Switched</h2>
        <p style="color:var(--text2)">Reloading in 3 seconds...</p>
      </div></div>`);
    setTimeout(()=>location.reload(),3000);
  }else{const e=await r?.json();showModalAlert(e?.detail||'Mode switch failed');}
}

/* ── User & tank modals ──────────────────────────────────────────────────── */
function showUserModal(user){
  const roles=['admin','chief_engineer','second_engineer','third_engineer','officer','master','shore_office','port_authority','viewer'];
  const isEdit=!!user;
  openModal(`<h2>${isEdit?'Edit User':'Add User'}</h2>
    <div class="form-grid-2">
      <div class="form-group"><label>Full Name *</label><input id="u-name" value="${user?.full_name||''}" placeholder="Full name"></div>
      <div class="form-group"><label>Username *</label><input id="u-user" value="${user?.username||''}" ${isEdit?'disabled':''} placeholder="username"></div>
      ${!isEdit?'<div class="form-group"><label>Password *</label><input type="password" id="u-pwd" placeholder="Password"></div>':''}
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
  const d={full_name:document.getElementById('u-name').value,role:document.getElementById('u-role').value,
    rank:document.getElementById('u-rank').value||null,email:document.getElementById('u-email').value||null,
    certificate_number:document.getElementById('u-cert').value||null};
  if(uid){const a=document.getElementById('u-active');if(a)d.is_active=a.value==='true';}
  else{d.username=document.getElementById('u-user').value;d.password=document.getElementById('u-pwd').value;}
  const r=await req(uid?'PUT':'POST',uid?`/users/${uid}`:'/users/',d);
  if(r&&r.ok){closeModal();loadSetupUsers();}
  else{const e=await r?.json();showModalAlert(e?.detail||'Failed');}
}

function showPwdModal(uid,username){
  openModal(`<h2>Change Password</h2><p style="color:var(--text2);margin-bottom:12px">User: <strong>${username}</strong></p>
    <div class="form-group"><label>New Password *</label><input type="password" id="np" placeholder="Min 6 characters"></div>
    <div class="form-group"><label>Confirm *</label><input type="password" id="cp" placeholder="Repeat password"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePwd('${uid}')">Change</button>
    </div>`);
}
async function savePwd(uid){
  const p=document.getElementById('np').value,c=document.getElementById('cp').value;
  if(p!==c){showModalAlert('Passwords do not match');return;}
  if(p.length<6){showModalAlert('Minimum 6 characters');return;}
  const r=await req('PUT',`/users/${uid}/password`,{new_password:p});
  if(r&&r.ok){closeModal();toast('Password changed','success');}
  else{const e=await r?.json();showModalAlert(e?.detail||'Failed');}
}

function showTankModal(vid){
  openModal(`<h2>Add Tank</h2>
    <div class="form-grid-2">
      <div class="form-group"><label>Tank Name *</label><input id="t-name" placeholder="e.g. HFO Tank Port FWD"></div>
      <div class="form-group"><label>Tank Type *</label><select id="t-type">${TO.map(t=>`<option value="${t}">${TL[t]||t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Capacity (m³) *</label><input type="number" step="0.01" id="t-cap" placeholder="e.g. 850.00"></div>
      <div class="form-group"><label>Position</label><select id="t-pos"><option value="">-</option><option value="port">Port</option><option value="starboard">Starboard</option><option value="center">Center</option></select></div>
      <div class="form-group"><label>Frame From</label><input id="t-ff" placeholder="e.g. 20"></div>
      <div class="form-group"><label>Frame To</label><input id="t-ft" placeholder="e.g. 45"></div>
      <div class="form-group"><label>External System ID</label><input id="t-ext" placeholder="Valmarine / Kongsberg / NAPA ID"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveTank('${vid}')">Add Tank</button>
    </div>`);
}

async function saveTank(vid){
  const d={vessel_id:vid,name:document.getElementById('t-name').value,tank_type:document.getElementById('t-type').value,
    capacity_m3:parseFloat(document.getElementById('t-cap').value),position:document.getElementById('t-pos').value||null,
    frame_from:document.getElementById('t-ff').value||null,frame_to:document.getElementById('t-ft').value||null,
    external_system_id:document.getElementById('t-ext').value||null};
  if(!d.name||!d.capacity_m3){showModalAlert('Name and capacity required');return;}
  const r=await req('POST','/tanks/',d);
  if(r&&r.ok){closeModal();await loadTanks();loadSetupTanks();}
  else{const e=await r?.json();showModalAlert(e?.detail||'Failed');}
}

async function removeTank(id,name){
  if(!confirm(`Remove tank "${name}"?`))return;
  const r=await req('DELETE',`/tanks/${id}`);
  if(r&&r.ok){await loadTanks();loadSetupTanks();}
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
function openModal(html){closeModal();document.getElementById('modal-box').innerHTML=html;document.getElementById('modal-overlay').style.display='flex';}
function closeModal(){document.getElementById('modal-overlay').style.display='none';}
function handleOverlay(e){if(e.target.id==='modal-overlay')closeModal();}
function showModalAlert(msg){let a=document.getElementById('modal-alert');if(!a){a=document.createElement('div');a.id='modal-alert';a.className='alert alert-error';document.getElementById('modal-box').prepend(a);}a.textContent=msg;}

/* ── Toast ───────────────────────────────────────────────────────────────── */
function toast(msg,type='success'){
  const t=document.createElement('div');
  t.className='toast';
  t.style.background=type==='success'?'#27ae60':type==='error'?'#c0392b':type==='warning'?'#e67e22':'#2979b8';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3500);
}

/* ── Boot ────────────────────────────────────────────────────────────────── */
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.getElementById('login-screen')?.style.display!=='none')login();
  if(e.key==='Escape')closeModal();
});
loadAppInfo();
if(token&&currentUser)boot();

/* ── Vessel Selector ─────────────────────────────────────────────────────── */
let activeVesselId = localStorage.getItem('dorb_vessel_id') || null;

async function openVesselSelector() {
    const r = await req('GET', '/vessel/list/all');
    if (!r || !r.ok) { toast('Could not load vessels','error'); return; }
    const vessels = await r.json();
    const isAdmin = currentUser.role === 'admin';

    const rows = vessels.map(v => `
        <tr onclick="selectVessel('${v.id}')" style="cursor:pointer" class="${activeVesselId===v.id?'active-vessel-row':''}">
            <td><strong>${v.name}</strong></td>
            <td><code style="font-size:.72rem">${v.imo_number}</code></td>
            <td>${v.flag_state}</td>
            <td><span class="badge badge-grey">${v.vessel_type_label}</span></td>
            <td><span class="badge badge-blue">${v.orb_mode_label}</span></td>
            <td>${v.gross_tonnage ? v.gross_tonnage+' GT' : '-'}</td>
            <td>${activeVesselId===v.id ? '<span class="badge badge-green">Active</span>' : ''}</td>
        </tr>`).join('');

    openModal(`<h2>&#9875; Select Vessel</h2>
        <div style="overflow-x:auto;margin-bottom:14px">
            <table class="data-table">
                <thead><tr><th>Vessel</th><th>IMO</th><th>Flag</th><th>Type</th><th>ORB Mode</th><th>GT</th><th></th></tr></thead>
                <tbody>${rows || '<tr><td colspan="7" class="empty-row">No vessels configured</td></tr>'}</tbody>
            </table>
        </div>
        ${isAdmin ? `<div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="showAddVesselForm()">+ Add Vessel</button>
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>` : `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`}
    `);
}

async function selectVessel(vesselId) {
    const r = await req('GET', `/vessel/by-id/${vesselId}`);
    if (!r || !r.ok) { toast('Could not load vessel','error'); return; }
    vesselData = await r.json();
    activeVesselId = vesselId;
    localStorage.setItem('dorb_vessel_id', vesselId);

    // Update topbar
    document.getElementById('topbar-vesselname').innerHTML = `${vesselData.name} <span style="font-size:.6rem;opacity:.5">&#9660;</span>`;
    document.getElementById('topbar-vesselinfo').textContent =
        `IMO ${vesselData.imo_number} | ${vesselData.flag_state} | ${vesselData.call_sign||'-'}`;
    document.getElementById('topbar-mode').textContent = vesselData.orb_mode_label;

    // Reload tanks for this vessel
    const tr = await req('GET', `/tanks/?vessel_id=${vesselId}`);
    if (tr && tr.ok) tanksData = await tr.json();

    closeModal();
    selectedTank = null;
    document.getElementById('right-panel').innerHTML = `
        <div class="right-placeholder">
            <div class="placeholder-icon">&#128674;</div>
            <p>Select a tank to view details and record operations</p>
        </div>`;
    renderTanks();
    checkAlarms();
    toast(`Switched to ${vesselData.name}`, 'success');
}

function showAddVesselForm() {
    const types = [
        ['passenger','Passenger Ship'],['bulk_carrier','Bulk Carrier'],
        ['general_cargo','General Cargo'],['container','Container Ship'],
        ['oil_tanker','Oil Tanker'],['product_tanker','Product Tanker'],
        ['chemical_tanker','Chemical Tanker'],['oil_barge','Oil Barge'],['other','Other']
    ];
    openModal(`<h2>+ Add New Vessel</h2>
        <div class="form-grid-2">
            <div class="form-group"><label>Vessel Name *</label><input id="nv-name" placeholder="e.g. MV Nordic Star"></div>
            <div class="form-group"><label>IMO Number *</label><input id="nv-imo" placeholder="e.g. 9123456"></div>
            <div class="form-group"><label>MMSI</label><input id="nv-mmsi" placeholder="e.g. 257123000"></div>
            <div class="form-group"><label>Call Sign</label><input id="nv-call" placeholder="e.g. LAQB"></div>
            <div class="form-group"><label>Flag State *</label><input id="nv-flag" placeholder="e.g. Norway"></div>
            <div class="form-group"><label>Vessel Type *</label>
                <select id="nv-type" onchange="previewOrbMode(this.value)">
                    ${types.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Gross Tonnage</label><input id="nv-gt" placeholder="e.g. 29814"></div>
            <div class="form-group"><label>Deadweight (T)</label><input id="nv-dwt" placeholder="e.g. 46500"></div>
            <div class="form-group"><label>Year Built</label><input id="nv-year" placeholder="e.g. 2007"></div>
            <div class="form-group"><label>Owner</label><input id="nv-owner" placeholder="Company name"></div>
            <div class="form-group"><label>Operator</label><input id="nv-oper" placeholder="Operator name"></div>
            <div class="form-group"><label>ORB Mode (auto)</label>
                <input id="nv-mode-prev" value="Part I — Machinery Space Only" disabled style="background:#f4f6f9;color:#6b7a8d"></div>
        </div>
        <div id="nv-msg"></div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="openVesselSelector()">Back</button>
            <button class="btn btn-primary" onclick="saveNewVessel()">Add Vessel</button>
        </div>`);
}

function previewOrbMode(type) {
    const tankers = ['oil_tanker','product_tanker','chemical_tanker','oil_barge'];
    const el = document.getElementById('nv-mode-prev');
    if (el) el.value = tankers.includes(type) ? 'Part I + Part II — Tanker Operations' : 'Part I — Machinery Space Only';
}

async function saveNewVessel() {
    const data = {
        name: document.getElementById('nv-name').value,
        imo_number: document.getElementById('nv-imo').value,
        mmsi: document.getElementById('nv-mmsi').value || null,
        call_sign: document.getElementById('nv-call').value || null,
        flag_state: document.getElementById('nv-flag').value,
        vessel_type: document.getElementById('nv-type').value,
        gross_tonnage: document.getElementById('nv-gt').value || null,
        deadweight: document.getElementById('nv-dwt').value || null,
        year_built: document.getElementById('nv-year').value || null,
        owner: document.getElementById('nv-owner').value || null,
        operator: document.getElementById('nv-oper').value || null,
    };
    if (!data.name || !data.imo_number || !data.flag_state) {
        document.getElementById('nv-msg').innerHTML = '<div class="alert alert-error">Name, IMO and Flag State are required</div>';
        return;
    }
    const r = await req('POST', '/vessel/', data);
    if (r && r.ok) {
        const vessel = await r.json();
        toast(`Vessel ${vessel.name} added successfully`, 'success');
        await selectVessel(vessel.id);
    } else {
        const err = await r?.json();
        document.getElementById('nv-msg').innerHTML = `<div class="alert alert-error">${err?.detail || 'Save failed'}</div>`;
    }
}
