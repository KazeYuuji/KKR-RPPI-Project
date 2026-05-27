function m(a,s="success"){const e=document.getElementById("toast-container"),n=document.createElement("div");n.className=`pointer-events-auto toast-enter rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${s==="success"?"bg-emerald-600 text-white shadow-emerald-300/30":"bg-red-600 text-white shadow-red-300/30"}`,n.textContent=a,e.appendChild(n),setTimeout(()=>{n.className=n.className.replace("toast-enter","toast-exit"),setTimeout(()=>n.remove(),300)},3e3)}async function c(){try{const s=await(await fetch("/api/stats")).json(),e=document.querySelectorAll("#stats-grid > div");if(e.length>=4){const n=[s.totalRegistrants,s.verified,s.pending,s.checkedIn];e.forEach((t,r)=>{const d=t.querySelector(".text-2xl");if(d&&n[r]!==void 0){const o=n[r];let i=0;const k=Math.max(1,Math.floor(o/30)),x=setInterval(()=>{i=Math.min(i+k,o),d.textContent=i,i>=o&&clearInterval(x)},30)}})}}catch{}}async function l(){try{const e=(await(await fetch("/api/registrants")).json()).registrants||[],n=document.getElementById("registrant-rows");if(!e.length){n.innerHTML='<tr><td colspan="6" class="py-12 text-center text-kkr-maroon/60 text-sm">Belum ada pendaftar.</td></tr>';return}n.innerHTML=e.map(t=>`
          <tr class="hover:bg-white/50 transition-colors">
            <td class="py-3.5 px-5">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-kkr-light to-kkr-light flex items-center justify-center text-xs font-bold text-kkr-red shrink-0">${t.name.charAt(0).toUpperCase()}</div>
                <span class="font-medium text-kkr-dark">${t.name}</span>
              </div>
            </td>
            <td class="py-3.5 px-5 text-kkr-maroon hidden sm:table-cell">${t.school}</td>
            <td class="py-3.5 px-5 text-kkr-maroon">${t.ticket}</td>
            <td class="py-3.5 px-5"><span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${t.status==="Verified"?"bg-emerald-50 text-emerald-700":"bg-kkr-gold/20 text-kkr-maroon"}"><span class="w-1 h-1 rounded-full ${t.status==="Verified"?"bg-emerald-500":"bg-kkr-gold"}"></span>${t.status}</span></td>
            <td class="py-3.5 px-5 hidden md:table-cell"><span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${t.checked_in?"bg-kkr-dark text-white":"bg-kkr-light/40 text-kkr-maroon"}">${t.checked_in?"✓ Checked-in":"— Belum"}</span></td>
            <td class="py-3.5 px-5 text-right">
              <div class="flex gap-1 justify-end">
                <button data-action="verify" data-id="${t.id}" class="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${t.status==="Verified"?"bg-kkr-gold/30 text-kkr-maroon hover:bg-kkr-gold/40":"bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}">${t.status==="Verified"?"Batal":"Verif"}</button>
                <button data-action="checkin" data-id="${t.id}" class="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${t.checked_in?"bg-kkr-light/60 text-kkr-purple hover:bg-slate-300":"bg-kkr-light/70 text-kkr-red hover:bg-kkr-light"}">${t.checked_in?"Batal":"CI"}</button>
              </div>
            </td>
          </tr>
        `).join("")}catch{}}async function g(){try{const s=await(await fetch("/api/tickets")).json(),e=document.getElementById("ticket-mini-list"),n=s.tickets||[];e.innerHTML=n.map(t=>`
          <div class="flex items-center justify-between rounded-xl border border-kkr-light/30 bg-white/50 p-3.5 transition hover:border-kkr-light/50">
            <div class="flex items-center gap-3">
              <div class="w-2 h-2 rounded-full ${t.remaining>0?"bg-emerald-400":"bg-red-400"}"></div>
              <div>
                <p class="text-sm font-semibold text-kkr-dark">${t.name}</p>
                <p class="text-xs text-kkr-maroon/80 mt-0.5">Sisa: ${t.remaining} tiket${t.expiry_date?` · Exp: ${t.expiry_date}`:""}</p>
              </div>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${t.remaining>0?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-700"}">${t.remaining>0?"Tersedia":"Habis"}</span>
          </div>
        `).join("")}catch{}}document.getElementById("registrant-rows")?.addEventListener("click",async a=>{const s=a.target.closest("button[data-action]");if(!s)return;const e=s.dataset.id,n=s.dataset.action;try{(await fetch("/api/registrants",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:e,action:n})})).ok&&(l(),c(),m("Berhasil diperbarui"))}catch{m("Gagal memperbarui","error")}});document.getElementById("checkin-form")?.addEventListener("submit",async a=>{a.preventDefault();const s=document.getElementById("checkin-id").value.trim();if(!s)return;const e=document.getElementById("checkin-result");e.className="rounded-xl p-3 text-sm";try{const n=await fetch("/api/registrants",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:s,action:"checkin"})}),t=await n.json();if(n.ok){const r=t.registrant?.name||"Peserta ditemukan",d=t.registrant?.checked_in?"Checked-in":"Belum check-in";e.className=`rounded-xl p-3 text-sm ${t.registrant?.checked_in?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-kkr-gold/20 text-kkr-maroon border border-kkr-gold/30"}`,e.textContent=`${r} — Status: ${d}`,l(),c()}else e.className="rounded-xl p-3 text-sm bg-red-50 text-red-700 border border-red-200",e.textContent=t.error||"ID tidak ditemukan"}catch{e.className="rounded-xl p-3 text-sm bg-red-50 text-red-700 border border-red-200",e.textContent="Terjadi kesalahan"}e.classList.remove("hidden")});document.addEventListener("DOMContentLoaded",()=>{c(),l(),g()});
