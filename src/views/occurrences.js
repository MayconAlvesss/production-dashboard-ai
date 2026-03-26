import { state } from '../state/store.js';
import { dbPath, setDoc, auth, signInAnonymously } from '../config/firebase.js';
import { formatCurrency } from '../utils/date.js';

export const openModalOS = () => {
    document.getElementById('os-id').value = "";
    document.getElementById('os-date').value = new Date().toISOString().substring(0, 7);
    document.getElementById('os-status').value = "Em Progresso";
    document.getElementById('os-reason').value = "manutencao";
    document.getElementById('os-obra').value = "";
    document.getElementById('os-days').value = "1";
    document.getElementById('os-obs').value = "";
    document.getElementById('os-number-display').textContent = "OS-" + Math.floor(Math.random() * 90000 + 10000);
    
    window.app.populateMachineSelect('os-machine');
    
    const tbody = document.getElementById('os-items-body');
    if(tbody) {
        tbody.innerHTML = '';
        window.app.addOsItemRow('Revisão / Peça', 1, 0);
    }
    
    window.app.openModal('modal-os');
};

export const addOsItemRow = (desc='', qty=1, price=0) => {
    const tbody = document.getElementById('os-items-body');
    if(!tbody) return;
    const tr = document.createElement('tr');
    tr.className = "group hover:bg-base/50 transition-colors";
    
    tr.innerHTML = `
        <td class="p-2"><input type="text" class="os-desc bg-transparent border-b border-border text-txmain p-2 w-full outline-none focus:border-brand-main text-sm" placeholder="Ex: Correia" value="${desc}"></td>
        <td class="p-2"><input type="number" min="1" class="os-qty bg-transparent border-b border-border text-txmain p-2 w-full outline-none focus:border-brand-main text-center text-sm" value="${qty}" onchange="app.calcOsTotal()" onkeyup="app.calcOsTotal()"></td>
        <td class="p-2 relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-txmuted text-xs">R$</span><input type="number" step="0.01" class="os-price bg-transparent border-b border-border text-txmain p-2 pl-8 w-full outline-none focus:border-brand-main text-right text-sm" value="${price}" onchange="app.calcOsTotal()" onkeyup="app.calcOsTotal()"></td>
        <td class="p-2 text-right os-row-total text-txmain font-mono text-sm font-bold">${formatCurrency(qty*price)}</td>
        <td class="p-2 text-center"><button onclick="this.closest('tr').remove(); app.calcOsTotal()" class="w-8 h-8 rounded text-txmuted hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors"><i class="ph-bold ph-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    window.app.calcOsTotal();
};

export const calcOsTotal = () => {
    const tbody = document.getElementById('os-items-body');
    if(!tbody) return 0;
    let totalGlobal = 0;
    
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
        const qty = parseFloat(tr.querySelector('.os-qty').value) || 0;
        const price = parseFloat(tr.querySelector('.os-price').value) || 0;
        const total = qty * price;
        tr.querySelector('.os-row-total').textContent = formatCurrency(total);
        totalGlobal += total;
    });
    
    const tv = document.getElementById('os-total-val');
    if(tv) tv.textContent = formatCurrency(totalGlobal);
    return totalGlobal;
};

export const saveOS = async () => {
    const existingId = document.getElementById('os-id').value;
    const osDate = document.getElementById('os-date').value;
    const osNumber = document.getElementById('os-number-display').textContent;
    const days = parseInt(document.getElementById('os-days').value) || 0;

    if(!osDate || days <= 0) return alert("Preencha o Mês de Referência e uma quantidade válida de dias.");

    if (!auth.currentUser) await signInAnonymously(auth);

    const items = [];
    Array.from(document.getElementById('os-items-body').querySelectorAll('tr')).forEach(tr => {
        const desc = tr.querySelector('.os-desc').value.trim();
        const qty = parseFloat(tr.querySelector('.os-qty').value) || 0;
        const price = parseFloat(tr.querySelector('.os-price').value) || 0;
        if(desc || price > 0) {
            items.push({ desc, qty, price, total: qty * price });
        }
    });

    const entry = {
        id: existingId || "OS_" + Date.now(),
        osNumber: osNumber, 
        date: osDate,
        machine: document.getElementById('os-machine').value,
        client: document.getElementById('os-obra').value || "Não informado",
        status: document.getElementById('os-status').value,
        reason: document.getElementById('os-reason').value,
        days: days,
        obs: document.getElementById('os-obs').value,
        items: items,
        totalValue: window.app.calcOsTotal()
    };

    if(existingId) {
        state.occurrences = state.occurrences.filter(o => o.id !== existingId);
    }
    state.occurrences.push(entry);
    await setDoc(dbPath, { occurrences: state.occurrences }, { merge: true });

    window.app.closeModal('modal-os');
    window.app.renderOccurrences();
    window.app.updateDashboard();
};

export const editOS = (id) => {
    const os = state.occurrences.find(o => o.id === id);
    if(!os) return;
    
    window.app.populateMachineSelect('os-machine');
    
    document.getElementById('os-id').value = os.id;
    document.getElementById('os-number-display').textContent = os.osNumber || "OS-antiga";
    document.getElementById('os-date').value = os.date;
    document.getElementById('os-status').value = os.status || "Em Progresso";
    document.getElementById('os-reason').value = os.reason || "manutencao";
    document.getElementById('os-machine').value = os.machine;
    document.getElementById('os-obra').value = os.client || "";
    document.getElementById('os-days').value = os.days;
    document.getElementById('os-obs').value = os.obs || "";
    
    const tbody = document.getElementById('os-items-body');
    if(tbody) tbody.innerHTML = '';
    
    if(os.items && os.items.length > 0) {
        os.items.forEach(i => window.app.addOsItemRow(i.desc, i.qty, i.price));
    } else {
        window.app.addOsItemRow('Serviço / Manutenção Global', 1, os.totalValue || 0);
    }
    
    window.app.openModal('modal-os');
};

export const renderOccurrences = () => {
    const searchMacEl = document.getElementById('occ-search-machine');
    const searchObraEl = document.getElementById('occ-search-obra');
    const list = document.getElementById('occ-list');
    
    const searchMac = searchMacEl ? searchMacEl.value.toLowerCase() : "";
    const searchObra = searchObraEl ? searchObraEl.value.toLowerCase() : "";
    
    if(!list) return;

    let filtered = [...state.occurrences];
    if(searchMac) filtered = filtered.filter(o => o.machine.toLowerCase().includes(searchMac));
    if(searchObra) filtered = filtered.filter(o => (o.client||"").toLowerCase().includes(searchObra));

    const sorted = filtered.sort((a,b) => b.date.localeCompare(a.date));

    if(sorted.length === 0) {
        list.innerHTML = `<div class="col-span-1 md:col-span-2 lg:col-span-3 text-center p-8 bg-surface rounded-2xl border border-border text-txmuted">Nenhuma Ordem de Serviço ou Parada encontrada.</div>`;
        return;
    }

    list.innerHTML = sorted.map(occ => {
        const isManut = occ.reason === 'manutencao';
        const isDone = occ.status === 'Concluído';
        const icon = isManut ? 'ph-wrench' : 'ph-barricade';
        
        const [year, month] = occ.date.split('-');
        const monthName = state.months[parseInt(month)-1];
        const displayDate = `${monthName}/${year}`;
        
        const totalOS = occ.totalValue || 0;

        return `
        <div class="bg-surface rounded-2xl border ${isDone ? 'border-border' : 'border-brand-main/50 shadow-[0_0_15px_rgba(220,38,38,0.1)]'} flex flex-col overflow-hidden transition-all hover:shadow-lg relative">
            ${!isDone ? `<div class="absolute top-0 right-0 bg-brand-main text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase">Em Progresso</div>` : ''}
            <div class="p-5 border-b border-border bg-panel/50 flex items-start gap-4">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isManut ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'}">
                    <i class="ph-bold ${icon} text-2xl"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-txmain truncate" style="color: var(--text-main);">${occ.machine}</p>
                    <p class="text-xs text-txmuted flex items-center gap-1 mt-1 truncate"><i class="ph-fill ph-buildings"></i> ${occ.client || 'Geral/Oficina'}</p>
                </div>
            </div>
            
            <div class="p-5 flex-1 space-y-4">
                <div class="flex justify-between items-center text-sm">
                    <span class="text-txmuted">Nº O.S.</span>
                    <span class="font-mono font-bold text-txmain">${occ.osNumber || '---'}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-txmuted">Competência</span>
                    <span class="font-bold uppercase text-txmain">${displayDate}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-txmuted">Ociosidade</span>
                    <span class="font-bold ${isManut ? 'text-red-500' : 'text-orange-500'}">${occ.days} Dias Parados</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-txmuted">Custo O.S.</span>
                    <span class="font-mono font-bold text-status-success">${formatCurrency(totalOS)}</span>
                </div>
            </div>
            
            <div class="p-4 bg-panel border-t border-border flex gap-3">
                <button onclick="app.editOS('${occ.id}')" class="flex-1 py-2 text-sm font-bold rounded-lg bg-base border border-border text-txmain hover:border-brand-main transition-colors text-center">Abrir OS</button>
                <button onclick="app.deleteEntry('${occ.id}', 'occurrence')" class="w-10 h-10 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors shrink-0">
                    <i class="ph-bold ph-trash"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
};
