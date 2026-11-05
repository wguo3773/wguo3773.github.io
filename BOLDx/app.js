'use strict';
let DATA;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (v,n=3) => v === null || v === undefined || !Number.isFinite(Number(v)) ? 'NA' : Number(v).toFixed(n);
const names = {bold:'Original BOLD',prediction:'BOLD + prediction',tite:'TITE-BOLD',combined:'TITE-BOLD + prediction',boin:'BOIN',tite_boin:'TITE-BOIN'};
const colors = {bold:'#61736D',prediction:'#008577',tite:'#477CA2',combined:'#805BA6',boin:'#C59A45',tite_boin:'#BD6B6F'};
const icons = () => { if(window.lucide) lucide.createIcons(); };
function math(root=document){
  root.querySelectorAll('[data-math]').forEach(el=>{
    try { katex.render(el.dataset.math,el,{throwOnError:false,displayMode:!el.classList.contains('inline-math'),output:'html',strict:false}); }
    catch {el.textContent=el.dataset.math;}
  });
}
function formula(s,small=false){return `<div class="formula${small?' small':''}" data-math="${esc(s)}"></div>`;}
function table(rows,cols,cls=''){
  return `<div class="table-scroll"><table class="${cls}"><thead><tr>${cols.map(c=>`<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c.html?c.html(r):esc(c.get?c.get(r):r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const designCell = r=>`<span class="design-tag"><span style="background:${colors[r.method]}"></span>${esc(names[r.method]||r.method)}</span>`;
function summaryTable(rows){return table(rows,[{label:'Design',html:designCell},
  {label:'Accuracy %',get:r=>num(r.accuracy_pct,2)},{label:'Mean N',get:r=>num(r.mean_n,3)},
  {label:'Actual DLTs / trial',get:r=>num(r.actual_dlts,3)},{label:'Above MTD %',get:r=>num(r.above_mtd_pct,2)},
  {label:'Duration months',get:r=>num(r.duration_months,3)}],'metrics-mini');}
function aggregateTable(rows){
  const fmt=(v,sd)=>v===null?'NA':`${num(v,2)} (${num(sd,2)})`;
  return table(rows,[{label:'Design',html:designCell},{label:'Scenarios',key:'n_scenarios'},
    {label:'Accuracy % (SD)',get:r=>fmt(r.accuracy_pct,r.accuracy_sd)},
    {label:'Actual DLTs (SD)',get:r=>fmt(r.actual_dlts,r.actual_dlts_sd)},
    {label:'Duration months (SD)',get:r=>fmt(r.duration_months,r.duration_sd)}]);
}
function historyTable(){return table(DATA.history,[{label:'Patient',get:r=>DATA.history.indexOf(r)+1},{label:'Dose',key:'dose'},{label:'Observed DLT',key:'dlt'},{label:'Follow-up months',key:'followup'}]);}
function incomingTable(){return table(DATA.plan,[{label:'Patient',get:r=>DATA.plan.indexOf(r)+1},{label:'Candidate dose',key:'dose'},{label:'Prediction',key:'prediction'},{label:'Eligible',get:r=>r.eligible?'TRUE':'FALSE'},{label:'Intervention flag',get:r=>r.intervene?'TRUE':'FALSE'}]);}
function riskTable(rows=DATA.scenarios.slice(0,6)){return table(rows.map((r,i)=>({r,i})),[{label:'Scenario',get:x=>x.i+1},...['D1','D2','D3','D4'].map((l,j)=>({label:l,get:x=>num(x.r[j],4)}))]);}
function codeBlock(code,label='R · input'){return `<div class="code-block"><div class="code-toolbar"><span>${esc(label)}</span><button class="icon-button copy" aria-label="Copy code" title="Copy code"><i data-lucide="copy"></i></button></div><pre><code>${esc(code)}</code></pre></div>`;}

const steps = {
 planning:[
  {id:'records',title:'Observed records',image:'micro-history',mini:'(d_i, y_i, t_i)',case:'history',detail:'Read the completed cohort',copy:'Three observed patients received dose 1, had no DLTs, and completed a three-month assessment window. No assumed true toxicity rates enter this calculation.'},
  {id:'mixture',title:'Weighted Beta update',image:'micro-branches',mini:String.raw`\sum_k w_k\,\mathrm{Beta}(A+k,B+m-k)`,case:'mixture',detail:'Follow latent-status branches inside the update',copy:'A prediction supplies evidence about an unobserved untreated outcome. Each unresolved contribution splits existing possibilities; equal-count components are merged and weights are normalized together.'},
  {id:'dose',title:'Dose & safety decision',image:'micro-dose',mini:String.raw`\gamma=0.90,\quad\tau=0.50`,case:'history',detail:'Apply overdose control, local ordering, and readiness rules',copy:'For the completed-cohort example, the result is escalation to dose 2. The reported candidate can instead be wait or stop; the output includes the reason and eliminated doses.'},
  {id:'prevention',title:'Incoming intervention plan',image:'micro-intervention',mini:String.raw`I_i=E_i\,\mathbf{1}(\widehat{Z}_i=1)`,case:'prediction',detail:'Flag the eligible positive incoming prediction',copy:'The incoming cohort has predictions (1, 0, 0). Only patient 1 is flagged for prevention, at candidate dose 2. The flags do not rewrite historical records or perform an intervention.'}
 ],
 simulation:[
  {id:'risks',title:'True risk scenarios',image:'micro-scenarios',mini:String.raw`\boldsymbol p=(p_1,\ldots,p_K)`,case:'random',detail:'Specify risks, or generate ordered scenarios',copy:'The executed random panel fixes MTD 2 at 0.25, its lower neighbor at 0.15 and its upper neighbor at 0.40. Fifty dose-4 risks are uniform draws between 0.40 and 0.70.'},
  {id:'trials',title:'Replicated trial histories',image:'micro-trials',mini:String.raw`Z_i\sim\mathrm{Bernoulli}(p_{d_i})`,case:'random',detail:'Generate outcomes, predictions, timing, and intervention success',copy:'For each would-be DLT, prediction sensitivity/specificity generate an external-model label. Eligible positive predictions can trigger prevention. Rho = 0.80 controls simulated intervention success; actual events then drive the trial rules.'},
  {id:'metrics',title:'Accuracy, DLTs & duration',image:'micro-metrics',mini:String.raw`\widehat A=100\,N_{\mathrm{correct}}/N_{\mathrm{trials}}`,case:'single',detail:'Inspect the executed single-scenario outputs',copy:'Each of six designs ran 1,000 trials at risks (0.05, 0.15, 0.30, 0.45, 0.60), target 0.30, MTD 3, and cap 21. These numbers illustrate tradeoffs, not universal superiority.'},
  {id:'spaghetti',title:'Scenario comparisons',image:'micro-spaghetti',mini:String.raw`g_s=|M_s-C_s|/\max(|M_s|,|C_s|)`,case:'spaghetti',detail:'Compare methods without hiding scenario variation',copy:'The 50 curves are true risk scenarios. Their colors compare combined TITE-BOLD + prediction with TITE-BOIN using saved per-scenario metrics. Change the metric or relative threshold without rerunning or changing the R results.'}
 ]
};
function buildSteps(lane){
  const root=$(`#${lane}-steps`);
  root.innerHTML=steps[lane].map((s,i)=>`<button class="microstep" data-lane="${lane}" data-step="${s.id}" aria-pressed="${i===0}" aria-controls="${lane}-detail"><span class="step-top"><span class="step-index">${lane==='planning'?'1':'2'}.${i+1}</span>${esc(s.title)}</span><img src="assets/${s.image}.png" alt="${esc(s.title)}: executed BOLDx example" width="620" height="310"><span class="mini-formula" data-math="${esc(s.mini)}"></span><span class="step-hint">Inspect this step <i data-lucide="arrow-right"></i></span></button>`).join('');
  root.addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(b)selectStep(lane,b.dataset.step);});
  selectStep(lane,steps[lane][0].id);
}
function selectStep(lane,id){
  const s=steps[lane].find(x=>x.id===id),i=steps[lane].indexOf(s);
  $(`#${lane}-steps`).querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.step===id));
  const root=$(`#${lane}-detail`);
  let content='';
  if(id==='records')content=`<div class="detail-grid"><div>${historyTable()}<p class="tiny-caption">Constructed example history. Exact input in Example 2.</p></div><div>${formula(String.raw`A=a_0+y_{\mathrm{observed}},\quad B=b_0+n_{\mathrm{known}}-y_{\mathrm{observed}}`)}${formula(String.raw`q_i=1-t_i/W\quad\text{for event-free, pending untreated patients}`,true)}<p class="tiny-caption"><code>dlt=0</code> before the window completes means event-free so far, not a confirmed non-DLT. A prevented counterfactual remains latent.</p><a href="#examples/history" class="text-link">See the complete call and output <i data-lucide="arrow-right"></i></a></div></div>`;
  if(id==='mixture')content=mixtureHTML();
  if(id==='dose')content=`<div class="detail-grid"><div>${table(DATA.dose_summary,[{label:'Dose',key:'dose'},{label:'Mean untreated risk',get:r=>num(r.mean_untreated_risk,3)},{label:'P(risk > 0.25)',get:r=>num(r.overdose_probability,4)},{label:'Excluded',get:r=>r.excluded?'TRUE':'FALSE'}])}</div><div>${formula(String.raw`\Pr(p_j>\phi\mid\mathcal D)>\gamma\ \Rightarrow\ \text{overdose elimination}`)}${formula(String.raw`d_{\mathrm{next}}\in\arg\min_{j\in\mathcal N(d)}|\widetilde{\mathrm{PPAT}}_j-\tau|`,true)}<p class="tiny-caption">Local order adjustment, ties, pending outcomes, and stopping rules also apply. Gamma and tau serve different purposes.</p><div class="interpretation"><strong>Executed result</strong>Escalate to dose 2. No eliminated doses.</div></div></div>`;
  if(id==='prevention')content=`<div class="detail-grid"><div>${incomingTable()}</div><div>${formula(String.raw`I_i=E_i\,\mathbf{1}(\widehat Z_i=1)\,\mathbf{1}(\text{dose assigned})`)}<p class="tiny-caption">An unavailable required prediction makes the plan not ready. A wait/stop never schedules prevention.</p><div class="interpretation"><strong>What happens next?</strong>Record actual interventions, observed DLTs, and updated follow-up before the next call. Preserve excluded doses. Do not substitute a predicted outcome for an observed one.</div></div></div>`;
  if(id==='risks')content=`<div class="detail-grid"><div>${riskTable()}<p class="tiny-caption">First six of the 50 seeded scenarios. Source CSV is downloadable.</p></div><div>${formula(String.raw`p_{j-1}=\phi-\Delta_L,\quad p_j=\phi,\quad p_{j+1}=\phi+\Delta_U`)}${formula(String.raw`p_4\sim\mathrm{Uniform}(0.40,0.70)\quad\text{in this panel}`,true)}<p class="tiny-caption">Boundary categories have distinct rules. MTD 0 means all too toxic; MTD K+1 means all below target. No free tail doses means repeated curves.</p></div></div>`;
  if(id==='trials')content=`<div class="detail-grid"><div>${table([{n:'Source of scenarios',v:'50 generated risk vectors'},{n:'Replicate trials',v:'1,000 per scenario and design'},{n:'Designs',v:'6, including Original BOLD'},{n:'Total simulated trials',v:'300,000'},{n:'Sensitivity / specificity',v:'0.90 / 0.98'},{n:'Rho / eligibility',v:'0.80 / 1.00'},{n:'Window / accrual',v:'3 months / 2 arrivals per month'},{n:'Seed',v:'42'}],[{label:'Input',key:'n'},{label:'Executed value',key:'v'}])}</div><div>${formula(String.raw`Z_i\sim\mathrm{Bernoulli}(p_{d_i}),\qquad S_i\mid Z_i=1,I_i=1\sim\mathrm{Bernoulli}(\rho)`)}${formula('Y_i=Z_i(1-I_i S_i)',true)}<p class="tiny-caption">Z is untreated toxicity; Y is actual observed toxicity after prevention. An intervention failure is an observed DLT. The scenario truth generates data but is unavailable to allocation decisions.</p></div></div>`;
  if(id==='metrics')content=`${summaryTable(DATA.single)}<div class="detail-grid"><div>${formula(String.raw`\widehat{\mathrm{DLT}}=N^{-1}\sum_{r=1}^{N}Y_r`)}${formula(String.raw`\widehat{\mathrm{AboveMTD}}=100\,\frac{\sum_r n_{r,>\mathrm{MTD}}}{\sum_r n_r}`,true)}</div><div class="interpretation"><strong>Read the tradeoff</strong>In this setting, Original BOLD's accuracy is ${num(DATA.single.find(x=>x.method==='bold').accuracy_pct,1)}%, and the combined design's is ${num(DATA.single.find(x=>x.method==='combined').accuracy_pct,1)}%. Prevention reduces actual DLTs here, but does not improve every accuracy comparison. NA duration is unavailable, not zero.</div></div>`;
  if(id==='spaghetti')content=spaghettiHTML('overview');
  root.innerHTML=`<div class="motion-enter"><div class="detail-head"><p class="eyebrow">Microstep ${lane==='planning'?'1':'2'}.${i+1}</p><h4>${esc(s.detail)}</h4></div><p>${esc(s.copy)}</p>${content}</div>`;
  math(root);icons();
  if(id==='mixture')initMixture(root);
  if(id==='spaghetti')initSpaghetti(root,'overview');
}

const mixtureModes={
 prior:{title:'Prior only',a:.75,b:2.25,q:[],labels:[],text:'No unresolved patients. The initial Beta prior remains unchanged.'},
 positive:{title:'One positive prediction',a:.75,b:2.25,q:[1],labels:[1],text:'One positive-prediction latent untreated outcome. Two weighted Beta components.'},
 two:{title:'Two positive predictions',a:.75,b:2.25,q:[1,1],labels:[1,1],text:'Two positive-prediction latent outcomes. The 10 and 01 paths share the same Beta parameters and are merged.'},
 pending:{title:'Combined: pending untreated outcomes',a:.75,b:2.25,q:[.75,.5],labels:[1,0],text:'Two untreated patients remain event-free at one-quarter and one-half of the assessment window, with positive and negative predictions.'},
 observed:{title:'Observed DLT replaces a pending prediction',a:1.75,b:2.25,q:[.5],labels:[0],text:'The first untreated patient now has an observed DLT: increment A. Only the remaining pending patient contributes a mixture branch.'},
 prevented:{title:'Prevention complete: untreated status stays latent',a:.75,b:3.25,q:[1],labels:[1],text:'One untreated patient completed the window without DLT: increment B. The intervention patient had no DLT, but their untreated status remains latent.'}
};
function mixtureHTML(){return `<div class="branch-tools"><label>Outcome / prediction state<select id="mixture-state">${Object.entries(mixtureModes).map(([k,v])=>`<option value="${k}" ${k==='two'?'selected':''}>${esc(v.title)}</option>`).join('')}</select></label></div><div class="detail-grid"><div id="branch-visual"></div><div id="mixture-results"></div></div><div class="formula small" data-math="${esc(String.raw`w_{t,k}=v_{t,k}/\sum_h v_{t,h},\qquad f(p)=\sum_k w_{t,k}\,\mathrm{Beta}(A+k,B+t-k)`)}"></div><details class="formula-details"><summary>Sequential weight formula</summary>${formula(String.raw`\theta_{k,z}=\frac{A+k+z}{A+B+t},\quad\ell_1=\Pr(\widehat Z\mid Z=1),\quad\ell_0=\Pr(\widehat Z\mid Z=0)`,true)}${formula(String.raw`c_1(k)=\frac{\ell_1 q_t\theta_{k,1}}{\ell_1 q_t\theta_{k,1}+\ell_0(1-\theta_{k,1})},\quad c_0(k)=\frac{\ell_0(1-\theta_{k,0})}{\ell_1 q_t\theta_{k,0}+\ell_0(1-\theta_{k,0})}`,true)}${formula('v_{t,k}=w_{t-1,k}c_0(k)+w_{t-1,k-1}c_1(k-1)',true)}<p class="tiny-caption">This reproduces the package's sequential mixture rule. For a positive label, ℓ₁ = sensitivity and ℓ₀ = 1 − specificity; a negative label uses 1 − sensitivity and specificity. Known outcomes update A/B before the latent contributions.</p></details>`;}
function initMixture(root){
  const select=root.querySelector('#mixture-state');
  function render(){
    const key=select.value,m=DATA.mixtures[key],ctx=mixtureModes[key];
    const c=Array.isArray(m.components)?m.components:[m.components];
    const svgNS='http://www.w3.org/2000/svg';
    let branch=`<svg class="branch-scene" viewBox="0 0 470 150" role="img" aria-label="${esc(ctx.title)} weighted Beta branches"><defs><marker id="beta-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="#7fa799"/></marker></defs><text x="12" y="75">Beta(${ctx.a}, ${ctx.b})</text>`;
    if(ctx.q.length===2){
      branch+=`<path d="M120 72L215 35M120 72L215 112" fill="none" stroke="#86b5a3" marker-end="url(#beta-arrow)"/><text x="177" y="28">z₁ = 1</text><text x="177" y="132">z₁ = 0</text>`;
      branch+=`<path d="M240 35L335 23M240 35L335 75M240 112L335 75M240 112L335 128" fill="none" stroke="#86b5a3" marker-end="url(#beta-arrow)"/>`;
      [2,1,0].forEach((k,j)=>{const row=c.find(v=>Math.abs(v.a-ctx.a-k)<1e-8);branch+=`<text x="345" y="${[27,79,132][j]}">Beta(${num(row.a,2)}, ${num(row.b,2)})</text>`;});
    } else if(ctx.q.length===1){
      branch+=`<path d="M120 72L315 35M120 72L315 112" fill="none" stroke="#86b5a3" marker-end="url(#beta-arrow)"/><text x="210" y="32">z = 1</text><text x="210" y="127">z = 0</text><text x="327" y="39">Beta(${num(c[1].a,2)}, ${num(c[1].b,2)})</text><text x="327" y="116">Beta(${num(c[0].a,2)}, ${num(c[0].b,2)})</text>`;
    } else branch+=`<path d="M130 72L300 72" fill="none" stroke="#86b5a3" marker-end="url(#beta-arrow)"/><text x="315" y="76">Prior, weight = 1</text>`;
    branch+='</svg>';
    const density=DATA.density[key],W=470,H=145,L=35,R=12,T=12,B=24;
    const maxY=Math.max(...density.y),xp=v=>L+v*(W-L-R),yp=v=>H-B-v/maxY*(H-T-B);
    const d=density.x.map((v,i)=>`${i?'L':'M'}${xp(v).toFixed(2)},${yp(density.y[i]).toFixed(2)}`).join(' ');
    branch+=`<svg class="density-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="R-computed weighted Beta mixture density"><path d="M${L},${T}V${H-B}H${W-R}" fill="none" stroke="#d1ded7"/><path d="${d}" fill="none" stroke="#087e71" stroke-width="2"/>${[0,.25,.5,.75,1].map(t=>`<text x="${xp(t)}" y="${H-7}" text-anchor="middle">${t}</text>`).join('')}<text x="${W-15}" y="18" text-anchor="end">untreated DLT risk</text></svg>`;
    root.querySelector('#branch-visual').innerHTML=branch+`<p class="tiny-caption">${esc(ctx.text)}</p>`;
    const qCode=ctx.q.length?`c(${ctx.q.join(',')})`:'numeric()';
    const labelCode=ctx.labels.length?`as.integer(c(${ctx.labels.join(',')}))`:'integer()';
    root.querySelector('#mixture-results').innerHTML=table(c,[{label:'Weight',get:r=>num(r.weight,6)},{label:'Beta a',get:r=>num(r.a,2)},{label:'Beta b',get:r=>num(r.b,2)}])+`<p class="tiny-caption">Mixture mean = <b>${num(m.mean,6)}</b><br>P(risk &gt; 0.25) = <b>${num(m.overdose_probability,6)}</b><br>Sum of weights = ${num(c.reduce((a,v)=>a+v.weight,0),6)}</p>${codeBlock(`beta_mixture(${ctx.a}, ${ctx.b}, q=${qCode},\n  labels=${labelCode},\n  sensitivity=.90, specificity=.98, target=.25)`,'R · this state')}`;
    icons();
  }
  select.addEventListener('change',render);render();
}

const spaghettiMetrics={accuracy_pct:'Accuracy (%)',actual_dlts:'Actual DLTs per trial',duration_months:'Duration (months)'};
function spaghettiHTML(prefix){return `<div class="chart-tools"><label>Comparison metric<select data-spaghetti-metric="${prefix}">${Object.entries(spaghettiMetrics).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Relative difference threshold: <span data-threshold-value="${prefix}">10%</span><input type="range" min="0" max="30" value="10" step="1" data-spaghetti-threshold="${prefix}" aria-label="Relative difference threshold"></label></div><div class="chart-layout"><div><svg class="spaghetti-chart" data-spaghetti-svg="${prefix}" viewBox="0 0 620 340" role="img" aria-label="Interactive dose-toxicity scenario comparison"></svg><div class="chart-key"><span><i class="key-line" style="border-color:#2563b5"></i>Combined better</span><span><i class="key-line" style="border-color:#bc4e50"></i>TITE-BOIN better</span><span><i class="key-line" style="border-color:#7f8c8d"></i>Below threshold</span></div><p class="tiny-caption" data-chart-counts="${prefix}"></p><p class="tiny-caption">Line height is untreated DLT risk, not the comparison metric. Hover, focus, or select a curve to inspect its saved estimates. Colors are not significance tests.</p></div><div class="chart-audit" data-chart-audit="${prefix}"></div></div>`;}
function comparisonData(metric,threshold){
  return DATA.scenarios.map((risks,i)=>{
    const a=DATA.panel_summary.find(r=>r.scenario===i+1&&r.method==='combined');
    const b=DATA.panel_summary.find(r=>r.scenario===i+1&&r.method==='tite_boin');
    const av=a[metric],bv=b[metric],den=Math.max(Math.abs(av),Math.abs(bv)),gap=den===0?0:Math.abs(av-bv)/den;
    const gain=(av-bv)*(metric==='accuracy_pct'?1:-1);
    const direction=gain!==0&&gap>=threshold?(gain>0?'method_better':'comparator_better'):'below_threshold';
    return {scenario:i+1,risks,a:av,b:bv,gap,direction,color:{method_better:'#2563b5',comparator_better:'#bc4e50',below_threshold:'#7f8c8d'}[direction]};
  });
}
function initSpaghetti(root,prefix){
  const metric=root.querySelector(`[data-spaghetti-metric="${prefix}"]`),slider=root.querySelector(`[data-spaghetti-threshold="${prefix}"]`),svg=root.querySelector(`[data-spaghetti-svg="${prefix}"]`);
  let selected=1,records=[];
  function audit(r){selected=r.scenario;root.querySelector(`[data-chart-audit="${prefix}"]`).innerHTML=`<h4>Scenario ${r.scenario}</h4><p class="scenario-data">Risks: ${r.risks.map(v=>num(v,4)).join(' → ')}<br>MTD 2 · upper gap 0.15 · 1,000 trials/design</p>${table([{design:'Combined',v:r.a},{design:'TITE-BOIN',v:r.b}],[{label:spaghettiMetrics[metric.value],key:'design'},{label:'Estimate',get:x=>num(x.v,4)}])}<p class="tiny-caption">Relative gap: <b>${num(r.gap*100,2)}%</b><br>${r.direction==='method_better'?'Combined better':r.direction==='comparator_better'?'TITE-BOIN better':'Difference below threshold'}<br>Difference / larger absolute estimate.</p>`;}
  function render(){
    const cutoff=Number(slider.value)/100;root.querySelector(`[data-threshold-value="${prefix}"]`).textContent=`${slider.value}%`;
    records=comparisonData(metric.value,cutoff);
    const W=620,H=340,L=55,R=18,T=22,B=48,xp=i=>L+i*(W-L-R)/3,yp=v=>H-B-v/.75*(H-T-B);
    let html=`<text x="${L}" y="12">True untreated DLT probability</text>`;
    [0,.15,.25,.4,.55,.7].forEach(v=>{html+=`<line x1="${L}" x2="${W-R}" y1="${yp(v)}" y2="${yp(v)}" stroke="${v===.25?'#c3b292':'#edf0ed'}" ${v===.25?'stroke-dasharray="4 4"':''}/><text x="${L-9}" y="${yp(v)+4}" text-anchor="end">${num(v,2)}</text>`;});
    for(let j=0;j<4;j++)html+=`<text x="${xp(j)}" y="${H-B+24}" text-anchor="middle">Dose ${j+1}</text>`;
    records.forEach(r=>{html+=`<path class="scenario-curve" tabindex="0" data-scenario="${r.scenario}" aria-label="Scenario ${r.scenario}: combined ${num(r.a,3)}, TITE-BOIN ${num(r.b,3)}, relative gap ${num(r.gap*100,2)} percent" d="${r.risks.map((v,j)=>`${j?'L':'M'}${xp(j)},${yp(v)}`).join(' ')}" fill="none" stroke="${r.color}" stroke-width="${r.scenario===selected?2.7:1.1}" opacity="${r.scenario===selected?1:.5}"/>`;});
    svg.innerHTML=html;
    const counts={method_better:0,comparator_better:0,below_threshold:0};records.forEach(r=>counts[r.direction]++);
    root.querySelector(`[data-chart-counts="${prefix}"]`).textContent=`50 scenarios · combined better ${counts.method_better} · TITE-BOIN better ${counts.comparator_better} · below threshold ${counts.below_threshold}`;
    audit(records[selected-1]);
  }
  svg.addEventListener('pointerover',e=>{const p=e.target.closest('[data-scenario]');if(!p)return;const r=records[Number(p.dataset.scenario)-1];audit(r);const tt=$('#chart-tooltip');tt.innerHTML=`Scenario ${r.scenario}<br>Combined ${num(r.a,3)} · TITE-BOIN ${num(r.b,3)}<br>Relative gap ${num(r.gap*100,2)}%`;tt.hidden=false;});
  svg.addEventListener('pointermove',e=>{const tt=$('#chart-tooltip');tt.style.left=`${Math.min(e.clientX+12,innerWidth-250)}px`;tt.style.top=`${Math.min(e.clientY+10,innerHeight-100)}px`;});
  svg.addEventListener('pointerleave',()=>$('#chart-tooltip').hidden=true);
  svg.addEventListener('focusin',e=>{if(e.target.dataset.scenario)audit(records[Number(e.target.dataset.scenario)-1]);});
  svg.addEventListener('click',e=>{if(e.target.dataset.scenario){selected=Number(e.target.dataset.scenario);render();}});
  metric.addEventListener('change',render);slider.addEventListener('input',render);render();
}

function figure(src,caption){return `<figure class="example-figure"><img src="assets/${src}" alt="${esc(caption)}" loading="lazy" data-expand="${src}"><div class="image-caption-tools"><figcaption>${esc(caption)}</figcaption><a href="assets/${src}" download>Download PNG</a></div></figure>`;}
function extraExample(id){
  if(id==='history')return `<div class="example-mini-table"><h3>Micro-example: the input history</h3>${historyTable()}</div>`;
  if(id==='prediction')return `<div class="example-mini-table"><h3>Micro-example: the resulting incoming plan</h3>${incomingTable()}</div>`;
  if(id==='mixture')return figure('prediction-branching-schematic.png','Formula schematic: latent untreated outcomes after prediction-guided intervention. The numeric component table above uses the executed a = 0.75, b = 2.25 example; this schematic gives the general update.')+figure('tite-prediction-branching-schematic.png','Formula schematic: observed untreated outcomes replace pending predictions. Prevention followed by no DLT does not reveal the untreated counterfactual.');
  if(id==='single')return `<div class="example-mini-table"><h3>Micro-example: six-design summary</h3>${summaryTable(DATA.single)}</div><p class="muted">For example, Original BOLD has 51.2% accuracy and 6.000 actual DLTs/trial in this run; the combined design has 49.1% accuracy and 1.695 actual DLTs/trial. This is a toxicity–accuracy tradeoff, not an improvement in every endpoint.</p>`;
  if(id==='random')return `<div class="example-mini-table"><h3>Micro-example: first six risk vectors</h3>${riskTable()}<h3>Scenario-level means and SDs</h3>${aggregateTable(DATA.aggregate)}</div>${formula(String.raw`\overline Q=\frac1{50}\sum_{s=1}^{50}\widehat Q_s,\qquad SD=\sqrt{\frac{\sum_s(\widehat Q_s-\overline Q)^2}{49}}`)}<p class="tiny-caption">The SD uses 50 scenario estimates. Monte Carlo SE within each scenario uses the 1,000 replicated trials. They are different summaries.</p>`;
  if(id==='spaghetti')return `<h3>Interactive version of the same 50-scenario results</h3>${spaghettiHTML('examples')}${figure('spaghetti-accuracy_pct.png','Native R output: accuracy comparison. Forty-one curves favor the combined design at the 10% threshold; nine are below the threshold in this executed panel.')}${figure('spaghetti-actual_dlts.png','Native R output: actual DLT comparison. Lower actual DLTs is the favorable direction; curves still display untreated toxicity risks.')}${figure('spaghetti-duration_months.png','Native R output: duration comparison. Lower duration is favorable; prediction-related waiting can make the combined design longer than TITE-BOIN.')}`;
  if(id==='boundary')return figure('spaghetti-boundary.png','Native R output: MTD 0 and MTD 2, each at upper gaps 0.15 and 0.20. Five scenarios per setting; all-too-toxic cases are included.');
  return '';
}
function buildExamples(){
  let html='',lastPart='';
  const toc=[`<a href="#examples/setup">Setup & installation</a><a href="#examples/input-reference">Input reference</a>`];
  DATA.cases.forEach(c=>{
    if(c.part!==lastPart){const text=c.part==='planning'?'Part 1 · Dose & intervention planning':'Part 2 · Simulation & plots';html+=`<h2 class="part-heading">${text}</h2>`;toc.push(`<div class="toc-heading">${text}</div>`);lastPart=c.part;}
    html+=`<section class="example-section" id="${c.id}"><h2>${esc(c.title)}</h2>${codeBlock(c.code)}<div class="output-block"><div class="output-label">Captured R output · BOLDx ${esc(DATA.version)}</div><pre><code>${esc(c.output)}</code></pre></div><div class="interpretation"><strong>Interpretation</strong>${esc(c.interpretation)}</div>${extraExample(c.id)}</section>`;
    toc.push(`<a href="#examples/${c.id}">${esc(c.title)}</a>`);
  });
  toc.push('<div class="toc-heading">Keep exploring</div><a href="#examples/downloads">Scripts & CSVs</a><a href="#examples/interpretation">Interpretation & boundaries</a>');
  $('#executed-examples').innerHTML=html;$('#toc').innerHTML=toc.join('');
  initSpaghetti($('#examples-page'),'examples');math($('#examples-page'));icons();
}
function route(){
  const route=(location.hash||'#overview').slice(1).split('/'),page=route[0]==='examples'?'examples':'overview';
  $('#overview-page').hidden=page!=='overview';$('#examples-page').hidden=page!=='examples';
  document.querySelectorAll('[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===page);if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=page==='examples'?'Examples | BOLDx':'BOLDx | Dose planning and simulation';
  requestAnimationFrame(()=>{if(page==='examples'&&route[1])document.getElementById(route[1])?.scrollIntoView({behavior:'instant',block:'start'});else window.scrollTo({top:0,behavior:'instant'});});
}
document.addEventListener('click',async e=>{
  const copy=e.target.closest('.copy');
  if(copy){const code=copy.closest('.code-block').querySelector('code').textContent;try{await navigator.clipboard.writeText(code);copy.innerHTML='<i data-lucide="check"></i>';copy.title='Copied';icons();setTimeout(()=>{copy.innerHTML='<i data-lucide="copy"></i>';copy.title='Copy code';icons();},1300);}catch{copy.title='Select the code and copy';}return;}
  const image=e.target.closest('[data-expand]');if(image){$('#expanded-image').src=image.src;$('#expanded-image').alt=image.alt;$('#expanded-caption').textContent=image.alt;$('#image-dialog').showModal();}
});
$('#close-image').addEventListener('click',()=>$('#image-dialog').close());
$('#image-dialog').addEventListener('click',e=>{if(e.target===$('#image-dialog'))$('#image-dialog').close();});
window.addEventListener('hashchange',route);
async function boot(){
  try{
    const response=await fetch('assets/examples.json');if(!response.ok)throw Error('Example data could not be loaded.');DATA=await response.json();
    document.querySelectorAll('[data-version]').forEach(e=>e.textContent=DATA.version);
    buildSteps('planning');buildSteps('simulation');buildExamples();math();icons();route();
  } catch(error){$('#executed-examples').innerHTML=`<div class="loading-error" role="alert">${esc(error.message)} Reload the page or download the R examples.</div>`;console.error(error);}
}
boot();
