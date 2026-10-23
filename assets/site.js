/* SaveGrow Lab — shared site behaviour (nav menu, calculator modal, assistant) */
const navLinks = document.getElementById('navLinks');

function toggleMenu(btn){
  if(!navLinks) return false;
  const open = navLinks.classList.toggle('mobile');
  if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  return open;
}
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>{
  if(!navLinks) return;
  navLinks.classList.remove('mobile');
  document.querySelector('.menu')?.setAttribute('aria-expanded','false');
}));

// Dynamic year in footer
const yearEl = document.getElementById('year');
if(yearEl) yearEl.textContent = new Date().getFullYear();

/* ---- Calculator modal (shared across pages).
   Pages without an #overlay element (About, Contact, legal pages, guide hub)
   fall back to navigating to the calculators hub so no buttons break. ---- */
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
  // Pages without the modal markup (About, Contact, legal pages, guide hub)
  // send the user to the calculators hub instead of throwing an error.
  if(!overlay || !sheetBody){ window.location.href = '/tools/'; return; }
  sheetTitle.textContent = title;
  sheetSub.textContent = sub;
  sheetBody.innerHTML = body;
  overlay.classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>sheetBody.querySelector('input,button')?.focus(),30);
}
function closeSheet(e){
  if(e && e.target!==overlay) return;
  if(!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow='';
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeSheet(); });

function toolButton(label='Calculate', fn=''){ return `<div class="calc-actions"><span class="subtle">Values are estimates for planning purposes only.</span><button class="btn primary" onclick="${fn}">${label} →</button></div>`; }
function resultCard(label,value,meta,stats=''){
  return `<div class="result"><div class="result-label">${label}</div><div class="result-value">${value}</div><div class="result-meta">${meta}</div>${stats?`<div class="result-grid">${stats}</div>`:''}</div>`;
}
function stat(label,value){return `<div class="result-stat"><b>${value}</b><span>${label}</span></div>`}

const SG_CHAT = {
  savings:'Savings goal', interest:'Interest & growth', budget:'Monthly budget',
  travel:'Trip budget', five:'The £5 basket rule', emergency:'Emergency fund'
};
function openTool(type){
  if(navLinks) navLinks.classList.remove('mobile');
  // No modal on this page? Deep-link to the calculators hub instead of erroring.
  if(!overlay){ window.location.href = '/tools/' + (SG_CHAT[type] ? '?tool=' + type : ''); return; }
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

/* ============================================================
   SAVEGROW ASSISTANT — floating, rule-based help chat.
   Injected on every page by site.js so the widget markup and
   styles live in one place (no duplication across HTML files).
   Keyword rules map questions to guides, tools and pages.
   100% local: nothing typed here is stored or sent anywhere.
   ============================================================ */
const SG_CSS = `
.chat-fab{position:fixed;right:22px;bottom:22px;z-index:60;display:flex;align-items:center;gap:9px;border:1px solid rgba(103,232,249,.35);background:linear-gradient(135deg,#0e2b47,#0a1f33);color:#dff9ff;font-weight:800;font-size:14px;padding:13px 17px;border-radius:999px;box-shadow:0 16px 44px rgba(0,0,0,.4);transition:.2s}
.chat-fab:hover{transform:translateY(-2px);border-color:rgba(103,232,249,.6)}
.chat-panel{position:fixed;right:22px;bottom:22px;z-index:61;width:min(380px,calc(100vw - 24px));max-height:min(560px,calc(100vh - 40px));display:none;flex-direction:column;background:linear-gradient(160deg,#0b1d31,#081522);border:1px solid var(--line-strong,rgba(255,255,255,.14));border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.55);overflow:hidden;animation:sgRise .18s ease-out}
.chat-panel.open{display:flex}
@keyframes sgRise{from{transform:translateY(14px);opacity:.55}to{transform:none;opacity:1}}
.chat-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03)}
.chat-title{font-weight:850;font-size:15px;color:#eaf4fd}
.chat-sub{font-size:11px;color:#73869c;margin-top:2px}
.chat-close{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff;border-radius:9px;padding:6px 9px;font-size:13px}
.chat-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.chat-msg{max-width:88%;padding:10px 12px;border-radius:14px;font-size:13.5px;line-height:1.6}
.chat-msg.bot{align-self:flex-start;background:rgba(87,170,248,.1);border:1px solid rgba(87,170,248,.18);color:#c3d9ea;border-bottom-left-radius:4px}
.chat-msg.user{align-self:flex-end;background:rgba(91,228,154,.12);border:1px solid rgba(91,228,154,.22);color:#d9f5e6;border-bottom-right-radius:4px}
.chat-msg a{color:#67e8f9;text-decoration:underline;text-underline-offset:2px}
.chat-msg .inline-tool-btn{display:block;margin-top:8px}
.chat-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.chat-chip{font-size:11px;font-weight:750;color:#ccecff;border:1px solid rgba(87,170,248,.25);background:rgba(87,170,248,.08);border-radius:999px;padding:5px 9px}
.chat-chip:hover{background:rgba(87,170,248,.18)}
.chat-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.02)}
.chat-input{flex:1;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:#0c2137;color:#fff;outline:none;font-size:14px}
.chat-input:focus{border-color:rgba(103,232,249,.45);box-shadow:0 0 0 3px rgba(103,232,249,.08)}
.chat-send{border:none;border-radius:11px;padding:10px 14px;font-weight:850;color:#06111f;background:linear-gradient(135deg,#7dd3fc,#70efbc)}
@media(max-width:480px){.chat-fab span{display:none}.chat-fab{padding:14px}}
`;

const SG_RULES = [
  {id:'greeting', kw:['hello','hi ','hey','good morning','good afternoon','howdy'],
   reply:"Hello! I'm the SaveGrow assistant. Ask me about saving goals, budgets, compound interest, emergency funds, trips or UK investing — I'll point you to the right calculator or guide.",
   chips:['Savings goal','Budget help','Compound interest']},
  {id:'thanks', kw:['thank','thanks','cheers'],
   reply:"You're welcome! If another money question pops up, just ask — every calculator here runs privately in your browser.",
   chips:[]},
  {id:'bye', kw:['bye','goodbye','see you'],
   reply:"Take care! The Savings Goal calculator is a good first stop next time. 👋",
   chips:[]},
  {id:'savings-goal', kw:['save for','saving for','goal','target','holiday fund','wedding','monthly saving','save monthly','how much do i need'],
   reply:"A named target is the fastest way to actually save. The Savings Goal calculator works out the monthly amount you need — or how long your current pace will take. The <a href='/guides/how-to-save-money.html'>saving plan guide</a> explains how to keep the habit going.",
   action:{label:'Open Savings Goal calculator', tool:'savings'}},
  {id:'budget', kw:['budget','50/30/20','spending plan','afford','short at the end','money runs out','split my income'],
   reply:"Try the Monthly Budget tool: enter your take-home pay and it splits it across essentials, flexible spending and saving using 50/30/20 (or 60/20/20 / 70/15/15 if rent is high). The <a href='/guides/budgeting-guide-uk.html'>UK budgeting guide</a> covers real salary examples.",
   action:{label:'Open Monthly Budget tool', tool:'budget'}},
  {id:'compound', kw:['compound','interest rate','aer','apy','double my money','rule of 72','how does interest work','growth'],
   reply:"Compound interest means earning returns on your returns — early years look slow, later ones accelerate. The Interest &amp; Growth calculator compares simple vs compound with monthly contributions. Worked examples are in the <a href='/guides/compound-interest-explained.html'>compound interest guide</a>.",
   action:{label:'Open Interest & Growth calculator', tool:'interest'}},
  {id:'emergency', kw:['emergency fund','rainy day','job loss','redundancy','cushion','unexpected bill','car broke','how much cash should i keep'],
   reply:"An emergency fund turns a crisis into an inconvenience. Sensible ladder: one month of essential costs first, then three to six. The Emergency Fund tool shows your current coverage and what closes the gap — details in the <a href='/guides/emergency-fund-uk.html'>emergency fund guide</a>.",
   action:{label:'Open Emergency Fund tool', tool:'emergency'}},
  {id:'travel', kw:['trip','holiday','travel','vacation','flight','honeymoon','city break'],
   reply:"Plan the fun part first: the Trip Budget tool adds transport, accommodation, food per day, activities and a contingency buffer. Then turn the total into a monthly figure with the Savings Goal calculator, or compare destinations with the <a href='/tools/savings-pace-compare.html'>savings pace tool</a>.",
   action:{label:'Open Trip Budget tool', tool:'travel'}},
  {id:'shopping', kw:['shopping','basket','supermarket','till','checkout','impulse','£5','five pound','small purchases'],
   reply:"The £5 basket rule is a quick mental trick: treat each ordinary item as roughly £5, so eight items ≈ £40 before you reach the till. It keeps the whole basket visible instead of judging items one at a time. More systems in the <a href='/guides/how-to-save-money.html'>saving guide</a>.",
   action:{label:'Try the £5 Basket tool', tool:'five'}},
  {id:'investing', kw:['invest','stocks','shares','etf','fund','portfolio','risk','index fund','beginner'],
   reply:"Investing means accepting short-term uncertainty for possible long-term growth — never invest money you'll need within 3–5 years. Start with the <a href='/guides/investing-for-beginners-uk.html'>beginner investing guide</a> (asset types, fees, diversification, FCA sources). This site is education, not personal advice.",
   chips:['ISA vs savings','Compound interest']},
  {id:'isa', kw:['isa','cash isa','stocks and shares','tax free','tax-free','allowance'],
   reply:"ISAs shelter interest or investment gains from UK tax within the annual allowance; a plain savings account doesn't. Which suits you depends on time horizon and risk — see the <a href='/guides/isa-vs-savings-account-uk.html'>ISA vs savings account comparison</a>.",
   chips:['Investing basics','Emergency fund']},
  {id:'debt', kw:['debt','loan','credit card','overdraft','borrow','repay'],
   reply:"Debt interest compounds too — usually faster than savings grow — so clearing high-rate cards often beats investing extra cash. Use the Monthly Budget tool to find headroom, then attack the highest-rate balance first. Background reading: the <a href='/guides/compound-interest-explained.html'>compound interest guide</a>.",
   action:{label:'Open Monthly Budget tool', tool:'budget'}},
  {id:'glossary', kw:['what does','meaning of','definition','jargon','acronym','ocf','fscs'],
   reply:"Plain-English definitions for 40+ money terms — AER, OCF, FSCS, liquidity and more — live in the <a href='/glossary.html'>SaveGrow Lab glossary</a>. You can also ask me about saving, budgeting or investing directly.",
   chips:[]},
  {id:'privacy', kw:['privacy','cookie','gdpr','personal information','secure','stored','data'],
   reply:"Your privacy is built in: no account needed, calculators run entirely in your browser, and the numbers you type are never sent to our servers. Google AdSense may use its own cookies. Full details in the <a href='/privacy-policy.html'>Privacy Policy</a>.",
   chips:[]},
  {id:'contact', kw:['contact','email','reach you','speak to someone','correction','report an error','feedback','support'],
   reply:"Email the editorial team at <a href='mailto:services@digitalinfohub.net'>services@digitalinfohub.net</a>, or use the <a href='/contact.html'>contact form</a> — it opens a pre-filled email in your mail app, so nothing is stored on our servers. We aim to reply within 2–3 business days.",
   chips:[]},
  {id:'about', kw:['who are you','what is savegrow','mission','who writes','about us'],
   reply:"SaveGrow Lab is an independent UK money-education project by the Digital Infohub editorial team: free in-browser calculators plus guides on saving, budgeting and beginner investing. We're not a regulated adviser. More on the <a href='/about.html'>About Us page</a>.",
   chips:[]},
  {id:'tools-list', kw:['tool','calculator','what can you do','options','features'],
   reply:"Seven free tools run in your browser: Savings Goal, Interest &amp; Growth, Monthly Budget, Trip Budget, £5 Basket, Emergency Fund, and the multi-goal <a href='/tools/savings-pace-compare.html'>Savings Pace Comparison</a>. Describe your situation and I'll pick one for you.",
   chips:['Savings goal','Budget help','Emergency fund']},
  {id:'guides-list', kw:['guide','article','read','learn','blog','resource'],
   reply:"Six in-depth guides: <a href='/guides/how-to-save-money.html'>saving systems</a>, <a href='/guides/compound-interest-explained.html'>compound interest</a>, <a href='/guides/emergency-fund-uk.html'>emergency funds</a>, <a href='/guides/budgeting-guide-uk.html'>UK budgeting</a>, <a href='/guides/investing-for-beginners-uk.html'>beginner investing</a> and <a href='/guides/isa-vs-savings-account-uk.html'>ISAs vs savings accounts</a> — all listed at the <a href='/guides/'>guides hub</a>.",
   chips:[]}
];
const SG_FALLBACK = "I'm a simple rule-based helper, so I might not follow everything — but I know my way around saving goals, budgets, compound interest, emergency funds, trips, shopping habits, UK investing and ISAs. Try naming what you want to work out, or browse the <a href='/tools/'>calculators</a> and <a href='/guides/'>guides</a>.";

function sgScore(text, kw){
  let s = 0;
  for(const k of kw){ if(text.includes(k)) s += (k.includes(' ') ? 2 : 1); }
  return s;
}
function sgMatch(raw){
  const text = ' ' + raw.toLowerCase().replace(/[^a-z0-9£$&'\/\s.-]/g,' ').replace(/\s+/g,' ') + ' ';
  let best = null, bestScore = 0;
  for(const rule of SG_RULES){
    const sc = sgScore(text, rule.kw);
    if(sc > bestScore){ best = rule; bestScore = sc; }
  }
  return best || {id:'fallback', reply:SG_FALLBACK, chips:['Savings goal','Budget help','Investing basics']};
}
function sgAppend(role, html){
  const log = document.getElementById('chatLog');
  if(!log) return;
  const m = document.createElement('div');
  m.className = 'chat-msg ' + role;
  m.innerHTML = html;
  log.appendChild(m);
  log.scrollTop = log.scrollHeight;
}
function sgChips(list){
  if(!list || !list.length) return '';
  return `<div class="chat-chips">${list.map(c=>`<button class="chat-chip" onclick="sgAsk('${c.replace(/'/g,"\\'")}')">${c}</button>`).join('')}</div>`;
}
function sgAsk(preset){
  const input = document.getElementById('chatInput');
  if(input){ input.value = preset; sgSend(); }
}
function sgSend(){
  const input = document.getElementById('chatInput');
  if(!input) return;
  const raw = input.value.trim();
  if(!raw){ input.focus(); return; }
  sgAppend('user', `<span>${raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`);
  input.value = '';
  const rule = sgMatch(raw);
  setTimeout(()=>{
    sgAppend('bot', `<span>${rule.reply}${rule.action ? ` <button class="inline-tool-btn" onclick="openTool('${rule.action.tool}')">${rule.action.label} →</button>` : ''}</span>${sgChips(rule.chips)}`);
  }, 250);
}
function toggleChat(){
  const panel = document.getElementById('chatPanel');
  const fab = document.getElementById('chatFab');
  if(!panel) return false;
  const open = panel.classList.toggle('open');
  if(fab) fab.style.display = open ? 'none' : 'flex';
  if(open) setTimeout(()=>document.getElementById('chatInput')?.focus(), 50);
  return open;
}
// Opens the assistant from any trigger (e.g. the banner at the top of index.html).
function openChat(){
  const panel = document.getElementById('chatPanel');
  if(panel && !panel.classList.contains('open')) toggleChat();
  else if(!panel) setTimeout(openChat, 120); // widget still loading
}

/* On the calculators hub, auto-open the tool requested via ?tool=<type>. */
(function maybeAutoOpenTool(){
  try{
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tool');
    if(t && SG_CHAT[t] && typeof openTool === 'function'){
      setTimeout(()=>openTool(t), 300);
    }
  }catch(e){ /* file:// or unsupported — ignore */ }
})();
(function initChatWidget(){
  if(!document.body) return;
  const style = document.createElement('style');
  style.textContent = SG_CSS;
  document.head.appendChild(style);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button class="chat-fab" id="chatFab" aria-haspopup="dialog" aria-controls="chatPanel" aria-expanded="false" onclick="toggleChat()">💬<span>Ask SaveGrow</span></button>
    <section class="chat-panel" id="chatPanel" role="dialog" aria-modal="false" aria-labelledby="chatTitle">
      <header class="chat-head">
        <div><div class="chat-title" id="chatTitle">SaveGrow Assistant</div><div class="chat-sub">Rule-based help · runs locally, nothing is sent anywhere</div></div>
        <button class="chat-close" aria-label="Close assistant" onclick="toggleChat()">✕</button>
      </header>
      <div class="chat-log" id="chatLog" role="log" aria-live="polite"></div>
      <form class="chat-form" onsubmit="event.preventDefault(); sgSend();">
        <label class="skip-link" for="chatInput">Type your question</label>
        <input class="chat-input" id="chatInput" placeholder="e.g. How much should I save each month?" autocomplete="off" maxlength="300">
        <button class="chat-send" type="submit" aria-label="Send message">Send</button>
      </form>
    </section>`;
  document.body.appendChild(wrap);
  sgAppend('bot', `<span>Hi! I'm the SaveGrow assistant — a small rule-based helper (no AI cloud, nothing you type leaves this page). Ask about saving goals, budgeting, compound interest, emergency funds, trips, debt, ISAs or investing.</span>${sgChips(['Savings goal','Budget help','Emergency fund'])}`);
})();
