import {firebaseConfig} from "./firebase-config.js";
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getDatabase,ref,onValue,set} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
const $=id=>document.getElementById(id), KEY="ebm-fresh-v1";
const blank=()=>({machines:[],reports:[],maintenance:[]});
let state;try{state={...blank(),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{state=blank()}
let save=()=>{localStorage.setItem(KEY,JSON.stringify(state));render()}, mode="", timer;
let audioCtx=null, scanStream=null, scanLoop=false, knownReportIds=new Set(state.reports.map(r=>r.id));
async function playAlert(){
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx){msg("المتصفح لا يدعم تشغيل الصوت");return}
  audioCtx=audioCtx||new Ctx();
  if(audioCtx.state!=="running") await audioCtx.resume();
  const now=audioCtx.currentTime;
  [880,660,880].forEach((hz,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=now+i*.2;o.type="sine";o.frequency.value=hz;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.22,t+.025);g.gain.exponentialRampToValueAtTime(.001,t+.17);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+.18)});
 }catch(err){console.warn("Audio alert unavailable",err);msg("الصوت محجوب من المتصفح؛ اضغط زر التنبيهات مرة ثم جرّب")}
}
function stopCamera(){scanLoop=false;if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}const v=$("scanVideo");if(v)v.srcObject=null}
async function startCamera(){
 const message=$("scanMessage"), video=$("scanVideo");
 if(!navigator.mediaDevices?.getUserMedia){message.textContent="الكاميرا لا تعمل من معاينة الملفات. افتح الموقع من رابط HTTPS مثل GitHub Pages، ثم اسمح بالكاميرا.";return}
 try{
  // Modern native detector when available.
  if("BarcodeDetector" in window){
   let supported=[];try{supported=await BarcodeDetector.getSupportedFormats()}catch{}
   const wanted=["qr_code","code_128","code_39","ean_13","ean_8","upc_a","upc_e","itf","codabar"];
   const formats=wanted.filter(x=>supported.includes(x));
   if(formats.length){
    const detector=new BarcodeDetector({formats});
    scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    video.srcObject=scanStream;await video.play();scanLoop=true;message.textContent="وجّه الكاميرا إلى الباركود أو QR وثبّتها لحظة.";
    const tick=async()=>{if(!scanLoop)return;try{const hits=await detector.detect(video);if(hits.length&&hits[0].rawValue){acceptScannedValue(hits[0].rawValue);return}}catch(err){console.warn(err)}if(scanLoop)requestAnimationFrame(tick)};requestAnimationFrame(tick);return;
   }
  }
  // Fallback decoder for browsers without BarcodeDetector (loaded online).
  message.textContent="جارٍ تجهيز قارئ الباركود…";
  const ZXing=await import("https://esm.sh/@zxing/browser@0.1.5");
  const Reader=ZXing.BrowserMultiFormatReader;
  if(!Reader)throw new Error("تعذر تحميل قارئ الباركود");
  scanLoop=true;message.textContent="اسمح بالكاميرا ثم وجّهها إلى الباركود أو QR.";
  const reader=new Reader();
  await reader.decodeFromVideoDevice(undefined,video,(result,err,controls)=>{
   if(!scanLoop){controls?.stop();return}
   if(result){acceptScannedValue(result.getText());controls?.stop()}
  });
 }catch(err){console.error("Camera error:",err);stopCamera();message.textContent=err?.name==="NotAllowedError"?"تم رفض إذن الكاميرا. افتح إعدادات الموقع واسمح بالكاميرا ثم أعد المحاولة.":err?.name==="NotFoundError"?"لم يتم العثور على كاميرا في الجهاز.":"تعذر تشغيل الكاميرا. افتح الموقع من HTTPS في Chrome، واسمح بالكاميرا، وتأكد من اتصال الإنترنت."}
}
function acceptScannedValue(value){
 const input=document.querySelector('#form input[name="serial"]');
 if(input){input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}));}
 $("scanMessage").textContent="تمت قراءة السيريال: "+value;stopCamera();$("scanBackdrop").classList.remove("show");msg("تم التقاط السيريال من الكاميرا");
}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const time=()=>new Date().toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"});
function msg(s){$("toast").textContent=s;$("toast").classList.add("show");clearTimeout(timer);timer=setTimeout(()=>$("toast").classList.remove("show"),2500)}
function label(s){return s==="open"?"مفتوح":s==="working"?"جاري الإصلاح":"تم الإصلاح"}
function view(v){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===v));document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$("title").textContent=({dashboard:"لوحة التحكم",machines:"الماكينات",reports:"بلاغات الأعطال",maintenance:"سجل الصيانة"})[v]}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>view(b.dataset.view));
function render(){
 const open=state.reports.filter(r=>r.status!=="fixed");
 $("machinesN").textContent=state.machines.length;$("openN").textContent=open.length;$("fixedN").textContent=state.reports.length-open.length;$("maintN").textContent=state.maintenance.length;$("badge").textContent=open.length;
 $("machineRows").innerHTML=state.machines.map(m=>`<tr><td>${esc(m.code)}</td><td>${esc(m.name)}</td><td>${esc(m.serial||"—")}</td><td>${esc(m.department||"—")}</td><td><span class="pill ${m.status==="متوقفة"?"down":"ok"}">${esc(m.status||"تعمل")}</span></td><td>${esc(m.notes||"—")}</td><td><button class="mini" data-del-machine="${m.id}">حذف</button></td></tr>`).join("");$("machineEmpty").style.display=state.machines.length?"none":"block";
 let q=($("search").value||"").toLowerCase(),f=$("filter").value;let list=state.reports.filter(r=>(f==="all"||r.status===f)&&[r.machineName,r.machineCode,r.description,r.technician].join(" ").toLowerCase().includes(q));
 $("reportRows").innerHTML=list.map(r=>`<tr><td><b>${esc(r.machineName)}</b><br>${esc(r.machineCode)}</td><td>${esc(r.description)}</td><td>${esc(r.priority)}</td><td>${esc(r.technician||"—")}</td><td><span class="pill ${r.status}">${label(r.status)}</span></td><td>${esc(r.createdAt)}</td><td>${r.status==="open"?`<button class="mini" data-start="${r.id}">استلام</button>`:""} ${r.status!=="fixed"?`<button class="mini" data-fix="${r.id}">تم الإصلاح</button>`:""} <button class="mini" data-del-report="${r.id}">حذف</button></td></tr>`).join("");$("reportEmpty").style.display=list.length?"none":"block";
 $("maintRows").innerHTML=state.maintenance.slice().reverse().map(m=>`<tr><td>${esc(m.date)}</td><td>${esc(m.machineName)} (${esc(m.machineCode)})</td><td>${esc(m.description)}</td><td>${esc(m.technician||"—")}</td></tr>`).join("");$("maintEmpty").style.display=state.maintenance.length?"none":"block";
 $("recent").innerHTML=state.reports.length?state.reports.slice(-4).reverse().map(r=>`<p style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #edf1f6;padding:9px 0;font-size:12px"><span>${esc(r.machineName)}<br><small>${esc(r.description)}</small></span><span class="pill ${r.status}">${label(r.status)}</span></p>`).join(""):'<div class="empty">لا توجد بلاغات حتى الآن</div>';
 $("summary").innerHTML=state.machines.length?`<p>تعمل بشكل طبيعي: <b>${state.machines.filter(m=>m.status!=="متوقفة").length}</b></p><p>متوقفة / بها عطل: <b>${state.machines.filter(m=>m.status==="متوقفة").length}</b></p>`:'<div class="empty">أضف أول ماكينة لعرض الملخص</div>';
}
function field(l,n,type="text",ph="",required=true){return `<div class="field"><label>${l}</label>${type==="textarea"?`<textarea name="${n}" placeholder="${ph}" ${required?"required":""}></textarea>`:`<input name="${n}" type="${type}" placeholder="${ph}" ${required?"required":""}>`}</div>`}
function modal(title,html,m){mode=m;$("modalTitle").textContent=title;$("fields").innerHTML=html;$("modal").classList.add("show")}
function close(){$("modal").classList.remove("show");$("form").reset()}
$("close").onclick=$("cancel").onclick=close;
$("scanClose").onclick=()=>{stopCamera();$("scanBackdrop").classList.remove("show")};
$("startScan").onclick=startCamera;$("stopScan").onclick=()=>{stopCamera();$("scanMessage").textContent="تم إيقاف الكاميرا."};
$("scanBackdrop").addEventListener("click",e=>{if(e.target===$("scanBackdrop")){stopCamera();$("scanBackdrop").classList.remove("show")}});
$("addMachine").onclick=()=>modal("إضافة ماكينة",field("كود الماكينة","code","text","مثال: M-001")+field("اسم الماكينة","name","text","اسم الماكينة")+`<div class="field"><label>السيريال نمبر</label><div style="display:flex;gap:7px"><input name="serial" placeholder="اكتب السيريال أو صوّر الباركود"><button type="button" id="scanSerial" class="btn">📷 تصوير</button></div><small style="color:#8a95a8">التصوير يقرأ الباركود أو QR إن كان السيريال مطبوعًا عليه.</small></div>`+field("القسم","department","text","قسم الخياطة",false)+`<div class="field"><label>الحالة</label><select name="status"><option>تعمل</option><option>متوقفة</option></select></div>`+field("ملاحظات","notes","textarea","",false),"machine");
$("addReport").onclick=()=>{if(!state.machines.length){msg("أضف ماكينة أولًا");view("machines");return}modal("تسجيل بلاغ عطل",`<div class="field"><label>الماكينة</label><select name="machineId">${state.machines.map(m=>`<option value="${m.id}">${esc(m.code)} — ${esc(m.name)}</option>`).join("")}</select></div>`+field("وصف العطل","description","textarea","اشرح العطل")+field("اسم الفني","technician","text","اسم الفني",false)+`<div class="field"><label>الأولوية</label><select name="priority"><option>عادي</option><option>عاجل</option><option>حرج</option></select></div>`,"report")};
$("form").onsubmit=e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.currentTarget));if(mode==="machine"){if(state.machines.some(m=>m.code.toLowerCase()===d.code.trim().toLowerCase())){msg("كود الماكينة مستخدم بالفعل");return}state.machines.push({id:crypto.randomUUID(),...d});msg("تمت إضافة الماكينة")}else{let m=state.machines.find(x=>x.id===d.machineId);state.reports.push({id:crypto.randomUUID(),machineId:m.id,machineName:m.name,machineCode:m.code,description:d.description,technician:d.technician,priority:d.priority,status:"open",createdAt:time()});m.status="متوقفة";msg("تم تسجيل البلاغ");playAlert();if("Notification"in window&&Notification.permission==="granted")new Notification("بلاغ عطل جديد",{body:m.name+" — "+d.description})}save();close()};
document.addEventListener("click",e=>{let t=e.target;if(t.id==="scanSerial"){$("scanBackdrop").classList.add("show");$("scanMessage").textContent="اضغط بدء الكاميرا واسمح باستخدام الكاميرا."}if(t.dataset.delMachine){if(state.reports.some(r=>r.machineId===t.dataset.delMachine)){msg("لا يمكن حذف ماكينة مرتبطة ببلاغ");return}if(confirm("حذف الماكينة؟")){state.machines=state.machines.filter(m=>m.id!==t.dataset.delMachine);save()}}if(t.dataset.delReport&&confirm("حذف البلاغ؟")){state.reports=state.reports.filter(r=>r.id!==t.dataset.delReport);save()}if(t.dataset.start){let r=state.reports.find(x=>x.id===t.dataset.start);r.status="working";r.startedAt=time();save();msg("تم تسجيل استلام البلاغ")}if(t.dataset.fix){let r=state.reports.find(x=>x.id===t.dataset.fix);if(confirm("تأكيد إنهاء الإصلاح؟")){r.status="fixed";state.maintenance.push({date:time(),machineName:r.machineName,machineCode:r.machineCode,description:r.description,technician:r.technician});let m=state.machines.find(x=>x.id===r.machineId);if(m&&!state.reports.some(x=>x.machineId===m.id&&x.id!==r.id&&x.status!=="fixed"))m.status="تعمل";save();msg("تم تسجيل الإصلاح في سجل الصيانة")}}});
$("search").oninput=render;$("filter").onchange=render;
$("alerts").onclick=async()=>{await playAlert();if(!("Notification"in window)){msg("جرّب الصوت الآن؛ المتصفح لا يدعم الإشعارات");return}let p=await Notification.requestPermission();msg(p==="granted"?"تم السماح بإشعارات المتصفح":"اسمح بالإشعارات من إعدادات الموقع إذا أردتها")};
let dbRef=null;
if(firebaseConfig.databaseURL&&firebaseConfig.databaseURL!=="PASTE_REALTIME_DATABASE_URL_HERE"){try{initializeApp(firebaseConfig);const db=getDatabase();dbRef=ref(db,"ebmSystem/state");onValue(dbRef,s=>{let d=s.val();if(d){const incoming=Array.isArray(d.reports)?d.reports:[];const newOnes=incoming.filter(r=>!knownReportIds.has(r.id));newOnes.forEach(r=>{if(knownReportIds.size)playAlert();knownReportIds.add(r.id)});state={...blank(),...d};localStorage.setItem(KEY,JSON.stringify(state));render()}$("connection").textContent="● Firebase متصل";$("connection").style.color="#19a974"});const localSave=save;save=()=>{localStorage.setItem(KEY,JSON.stringify(state));render();set(dbRef,state).catch(e=>{console.error(e);msg("تعذر الحفظ في Firebase؛ راجع قواعد البيانات")})}}catch(e){console.error(e);$("connection").textContent="● تعذر الاتصال بـ Firebase"}}
render();
