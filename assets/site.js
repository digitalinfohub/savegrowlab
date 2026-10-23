/* SaveGrow Lab — shared site behaviour (nav menu, calculator modal) */
const navLinks = document.getElementById('navLinks');

function toggleMenu(btn){
  const open = navLinks.classList.toggle('mobile');
  if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>{
  navLinks.classList.remove('mobile');
  document.querySelector('.menu')?.setAttribute('aria-expanded','false');
}));

// Dynamic year in footer
const yearEl = document.getElementById('year');
if(yearEl) yearEl.textContent = new Date().getFullYear();

/* ---- Calculator modal (shared across pages) ---- */
const overlay = document.getElementById('overlay');
const sheetTitle = document.getElementById('sheetTitle');
const sheetSub = document.getElementById('sheetSub');
const sheetBody = document.getElementById('sheetBody');

const gbp = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
const num = id => { const v = Number(document.getElementById(id)?.value); return Number.isFinite(v) ? v : 0; };
function invalidInputs(containerId){
  const box = document.getElementById(containerId);
  if(!box) return false;
  return [...box.querySelectorAll('input[type="number"]')].some(i => i.value === '' || !Number.isFinite(Number(i.value)) || Number(i.value) < 0);
}
function errorCard(msg){
  return `<div class="result" style="background:rgba(255,143,143,.06);border-color:rgba(255,143,143,.25)"><div class="result-label">Check your inputs</div><div class="result-value" style="font-size:18px;letter-spacing:0">Something is missing or invalid</div><div class="result-meta">${msg} All fields need a number of zero or more (costs and months must be above zero).</div></div>`;
}

function openSheet(title, sub, body){
  sheetTitle.textContent = title;
  sheetSub.textContent = sub;
  sheetBody.innerHTML = body;
  overlay.classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>sheetBody.querySelector('input,button')?.focus(),30);
}
function closeSheet(e){
  if(e && e.target!==overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow='';
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeSheet(); });

function toolButton(label='Calculate', fn=''){ return `<div class="calc-actions"><span class="subtle">Values are estimates for planning purposes only.</span><button class="btn primary" onclick="${fn}">${label} →</button></div>`; }
function resultCard(label,value,meta,stats=''){
  return `<div class="result"><div class="result-label">${label}</div><div class="result-value">${value}</div><div class="result-meta">${meta}</div>${stats?`<div class="result-grid">${stats}</div>`:''}</div>`;
}
function stat(label,value){return `<div class="result-stat"><b>${value}</b><span>${label}</span></div>`}

function openTool(type){
  navLinks.classList.remove('mobile');
  if(type==='savings'){
    openSheet('Savings goal','Work out the monthly amount needed for a target, or see how long regular saving could take.',`
      <div class="tabs"><button class="tab active" id="saveModeAmount" onclick="switchSavingsMode('amount')">Target → monthly</button><button class="tab" id="saveModeTime" onclick="switchSavingsMode('time')">Monthly → time</button></div>
      <div id="savingFields"></div>
      <div id="savingResult"></div>`);
    switchSavingsMode('amount');
  }
  if(type==='interest'){
    openSheet('Interest & growth','Compare simple interest and compound growth with regular contributions.',`
      <div class="tabs"><button class="tab active" id="intCompound" onclick="switchInterest('compound')">Compound</button><button class="tab" id="intSimple" onclick="switchInterest('simple')">Simple interest</button></div>
      <div id="interestFields"></div><div id="interestResult"></div>`);
    switchInterest('compound');
  }
  if(type==='budget'){
    openSheet('Monthly budget','A quick guide for dividing income across essentials, flexible spending, saving and investing.',`
      <div class="field-grid">
        <div class="field"><label>Monthly take-home (£)</label><input id="bIncome" type="number" value="1600" min="0"></div>
        <div class="field"><label>Budget style</label><select id="bStyle"><option value="50/30/20">50 / 30 / 20</option><option value="60/20/20">60 / 20 / 20</option><option value="70/15/15">70 / 15 / 15</option></select></div>
      </div>
      ${toolButton('Build my budget','calcBudget()')}<div id="budgetResult"></div>`);
  }
  if(type==='travel'){
    openSheet('Trip budget','Estimate transport, accommodation, food, activities and a contingency buffer.',`
      <div class="field-grid">
        <div class="field"><label>Transport (£)</label><input id="tTransport" type="number" value="150" min="0"></div>
        <div class="field"><label>Accommodation (£)</label><input id="tAccommodation" type="number" value="300" min="0"></div>
        <div class="field"><label>Food per day (£)</label><input id="tFood" type="number" value="35" min="0"></div>
        <div class="field"><label>Days</label><input id="tDays" type="number" value="5" min="1"></div>
        <div class="field"><label>Activities (£)</label><input id="tActivities" type="number" value="100" min="0"></div>
        <div class="field"><label>Buffer (%)</label><input id="tBuffer" type="number" value="10" min="0"></div>
      </div>
      ${toolButton('Estimate trip cost','calcTravel()')}<div id="travelResult"></div>`);
  }
  if(type==='five'){
    openSheet('The £5 basket rule','A deliberately rough pricing heuristic. Treat each ordinary item as roughly £5, then compare with the real total.',`
      <div class="field-grid">
        <div class="field"><label>Number of items</label><input id="fiveItems" type="number" value="8" min="0"></div>
        <div class="field"><label>Rough price per item (£)</label><input id="fivePrice" type="number" value="5" min="0" step="0.50"></div>
      </div>
      ${toolButton('Estimate basket','calcFive()')}<div id="fiveResult"></div>`);
  }
  if(type==='emergency'){
    openSheet('Emergency fund','Estimate how many months of essential spending your current savings could cover.',`
      <div class="field-grid">
        <div class="field"><label>Emergency savings (£)</label><input id="eSavings" type="number" value="1500" min="0"></div>
        <div class="field"><label>Essential monthly costs (£)</label><input id="eCosts" type="number" value="800" min="1"></div>
        <div class="field"><label>Target months</label><input id="eTarget" type="number" value="3" min="1"></div>
      </div>
      ${toolButton('Check coverage','calcEmergency()')}<div id="emergencyResult"></div>`);
  }
}

function switchSavingsMode(mode){
  document.getElementById('saveModeAmount').classList.toggle('active',mode==='amount');
  document.getElementById('saveModeTime').classList.toggle('active',mode==='time');
  document.getElementById('savingFields').innerHTML = mode==='amount' ? `
    <div class="field-grid">
      <div class="field"><label>Target (£)</label><input id="sTarget" type="number" value="1500" min="0"></div>
      <div class="field"><label>Already saved (£)</label><input id="sCurrent" type="number" value="300" min="0"></div>
      <div class="field"><label>Months</label><input id="sMonths" type="number" value="6" min="1"></div>
      <div class="field"><label>Interest (%) optional</label><input id="sRate" type="number" value="0" min="0" step="0.1"></div>
    </div>${toolButton('Calculate monthly saving','calcSavingsAmount()')}`
    :
    `<div class="field-grid">
      <div class="field"><label>Target (£)</label><input id="s2Target" type="number" value="1500" min="0"></div>
      <div class="field"><label>Already saved (£)</label><input id="s2Current" type="number" value="300" min="0"></div>
      <div class="field"><label>Monthly saving (£)</label><input id="s2Monthly" type="number" value="200" min="1"></div>
    </div>${toolButton('Calculate time','calcSavingsTime()')}`;
  document.getElementById('savingResult').innerHTML='';
}
function calcSavingsAmount(){
  if(invalidInputs('savingFields')){document.getElementById('savingResult').innerHTML=errorCard('Enter numbers in every field above.');return}
  const target=num('sTarget'), current=num('sCurrent'), months=Math.max(1,num('sMonths')), rate=Math.max(0,num('sRate'))/100/12;
  if(target<=current){document.getElementById('savingResult').innerHTML=resultCard('Already reached','£0','Your current savings meet or exceed the target. Well done — consider naming your next goal, or moving this money into a dedicated savings account so it stays out of reach.');return}
  let monthly;
  if(rate===0) monthly=(target-current)/months;
  else monthly=(target-current* Math.pow(1+rate,months))*rate/(Math.pow(1+rate,months)-1);
  if(!Number.isFinite(monthly)||monthly<0){document.getElementById('savingResult').innerHTML=errorCard('Those figures produced an impossible result — check the interest rate and months.');return}
  document.getElementById('savingResult').innerHTML=resultCard('Estimated monthly saving',gbp(monthly),`To reach ${gbp(target)} in about ${months} months, starting from ${gbp(current)}${rate>0?` with ${(rate*12*100).toFixed(1)}% annual interest`:''}. Assumes contributions at month-end and a constant rate.`,stat('Target',gbp(target))+stat('Starting',gbp(current))+stat('Monthly',gbp(monthly)));
}
function calcSavingsTime(){
  if(invalidInputs('savingFields')){document.getElementById('savingResult').innerHTML=errorCard('Enter numbers in every field above.');return}
  const target=num('s2Target'), current=num('s2Current'), monthly=num('s2Monthly');
  const remaining=Math.max(0,target-current);
  if(monthly<=0){document.getElementById('savingResult').innerHTML=errorCard('Monthly saving must be more than £0 to make progress.');return}
  const months=Math.ceil(remaining/monthly);
  const yearsText=months>=12?`, about ${(months/12).toFixed(1)} years`:'';
  document.getElementById('savingResult').innerHTML=resultCard('Estimated time',`${months} month${months===1?'':'s'}${yearsText}`,`At ${gbp(monthly)} per month, excluding interest. ${months>36?'That is a long horizon — consider a smaller first milestone to stay motivated.':''}`,stat('Remaining',gbp(remaining))+stat('Monthly',gbp(monthly))+stat('Target',gbp(target)));
}

function switchInterest(mode){
  document.getElementById('intCompound').classList.toggle('active',mode==='compound');
  document.getElementById('intSimple').classList.toggle('active',mode==='simple');
  document.getElementById('interestFields').innerHTML = `
    <div class="field-grid">
      <div class="field"><label>Starting amount (£)</label><input id="iPrincipal" type="number" value="1000" min="0"></div>
      <div class="field"><label>Monthly addition (£)</label><input id="iMonthly" type="number" value="100" min="0"></div>
      <div class="field"><label>Annual rate (%)</label><input id="iRate" type="number" value="4.5" min="0" step="0.1"></div>
      <div class="field"><label>Years</label><input id="iYears" type="number" value="5" min="1"></div>
    </div>
    ${toolButton('Calculate',`calcInterest('${mode}')`)}`;
  document.getElementById('interestResult').innerHTML='';
}
function calcInterest(mode){
  if(invalidInputs('interestFields')){document.getElementById('interestResult').innerHTML=errorCard('Enter numbers in every field above.');return}
  const p=num('iPrincipal'),m=num('iMonthly'),r=Math.max(0,num('iRate'))/100,y=Math.min(80,Math.max(1,num('iYears')));
  const months=Math.round(y*12);
  let total=p;
  if(mode==='compound'){
    const monthlyRate=r/12;
    for(let i=0;i<months;i++) total=total*(1+monthlyRate)+m;
  } else {
    total=p*(1+r*y)+m*months;
  }
  const contributed=p+m*months, growth=total-contributed;
  const capNote = num('iYears')>80 ? ' Capped at 80 years for this estimate.' : '';
  document.getElementById('interestResult').innerHTML=resultCard(`Estimated value after ${y} year${y===1?'':'s'}`,gbp(total),`Illustrative calculation at ${(r*100).toFixed(1)}% annual rate with ${gbp(m)} added monthly. ${mode==='compound'?'Compound mode applies interest to the growing balance each month — over long horizons most of your total comes from growth rather than contributions.':`Simple mode credits interest only on the starting amount: ${gbp(p*r*y)} over ${y} year${y===1?'':'s'}.`}${capNote}`,stat('Contributed',gbp(contributed))+stat('Growth',gbp(growth))+stat('Growth share',total>0?((growth/total)*100).toFixed(0)+'%':'—'));
}

function calcBudget(){
  if(invalidInputs('sheetBody')){document.getElementById('budgetResult').innerHTML=errorCard('Enter a take-home figure.');return}
  const income=num('bIncome'), style=document.getElementById('bStyle').value.split('/').map(Number);
  if(income<=0){document.getElementById('budgetResult').innerHTML=errorCard('Income must be more than £0.');return}
  const [ess,flex,save]=style.map(x=>income*x/100);
  document.getElementById('budgetResult').innerHTML=resultCard('Suggested monthly split',gbp(income),`Using a ${style[0]} / ${style[1]} / ${style[2]} framework. This is a template, not a strict rule — if rent and bills exceed the essentials allowance, shift the percentages rather than abandoning the plan.${save>=income*0.15?' That saving rate compounds quickly — project it in the Interest &amp; Growth tool.':''}`,stat('Essentials',gbp(ess))+stat('Flexible',gbp(flex))+stat('Save / invest',gbp(save)));
}

function calcTravel(){
  if(invalidInputs('sheetBody')){document.getElementById('travelResult').innerHTML=errorCard('Enter numbers in every field above.');return}
  const days=Math.max(1,num('tDays'));
  const base=num('tTransport')+num('tAccommodation')+(num('tFood')*days)+num('tActivities');
  if(base<=0){document.getElementById('travelResult').innerHTML=errorCard('Add at least some costs to get an estimate.');return}
  const buffer=base*Math.max(0,num('tBuffer'))/100, total=base+buffer;
  document.getElementById('travelResult').innerHTML=resultCard('Estimated trip budget',gbp(total),`Base trip estimate ${gbp(base)} plus ${gbp(buffer)} contingency (${num('tBuffer')}%). That is about ${gbp(total/days)} per day over ${days} day${days===1?'':'s'} — turn it into a monthly target with the Savings Goal tool.`,stat('Transport',gbp(num('tTransport')))+stat('Accommodation',gbp(num('tAccommodation')))+stat('Food',gbp(num('tFood')*days)));
}
function calcFive(){
  if(invalidInputs('sheetBody')){document.getElementById('fiveResult').innerHTML=errorCard('Enter item count and rough price.');return}
  const items=num('fiveItems'), price=num('fivePrice'), total=items*price;
  document.getElementById('fiveResult').innerHTML=resultCard('Quick basket estimate',gbp(total),`${items} item${items===1?'':'s'} × ${gbp(price)}. Replace this with actual prices for precise budgeting. Do it weekly and you will quickly see what “small shopping” really costs per year.`,stat('Items',items)+stat('Rough item price',gbp(price))+stat('Estimate',gbp(total)));
}
function calcEmergency(){
  if(invalidInputs('sheetBody')){document.getElementById('emergencyResult').innerHTML=errorCard('Enter savings, costs and target months.');return}
  const savings=num('eSavings'), costs=Math.max(1,num('eCosts')), target=Math.min(24,Math.max(1,num('eTarget')));
  const months=savings/costs, remaining=Math.max(0,target*costs-savings);
  const verdict = months>=target ? `You already cover ${target} months — consider whether extra cash should stay liquid or move towards longer-term goals.`
    : months>=1 ? `A solid start. To close the gap, split ${gbp(remaining)} over a realistic timeline — e.g. ${gbp(remaining/12)} a month reaches it within a year.`
    : `Even one week of costs saved builds a first cushion. Start small, automate it, then raise the amount when your income allows.`;
  document.getElementById('emergencyResult').innerHTML=resultCard('Current coverage',`${months.toFixed(1)} months`,`At ${gbp(costs)} of essential costs per month. ${verdict}`,stat('Current savings',gbp(savings))+stat('Target',`${target} months`)+stat('To target',gbp(remaining)));
}
