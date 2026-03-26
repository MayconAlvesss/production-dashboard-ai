import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const GEMINI_KEY = ""; 
const firebaseConfig = {
    apiKey: "AIzaSyD26o_heKopixxpHrcT6yGR1PaY4TVpI1U",
    authDomain: "dashboard-producao-empresa.firebaseapp.com",
    projectId: "dashboard-producao-empresa",
    storageBucket: "dashboard-producao-empresa.firebasestorage.app",
    messagingSenderId: "246718812896",
    appId: "1:246718812896:web:3b31a9ce2bc3ccb78e3685"
};

const fb = initializeApp(firebaseConfig);
const db = getFirestore(fb);
const auth = getAuth(fb);
const dbPath = doc(db, 'dashboards', 'sharedDashboardData');

const state = {
    data: {}, 
    occurrences: [], 
    serviceTypes: ["Hélice Contínua", "Estaca Pré-moldada", "Concretagem", "Sondagem"],
    machineTypes: ["Equipamento 01", "Equipamento 02"],
    machineConfig: {}, 
    serviceColors: {},
    charts: {},
    months: ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],
    colorMap: { "Perfuratriz": "#3b82f6", "Bate-Estaca": "#10b981", "Bomba de Concreto": "#a855f7" },
    defaultPalette: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'],
    tempPrompt: null,
    tempConfirm: null
};

const getCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const getWeekOfMonth = (dateStr) => {
    if(!dateStr) return 1;
    const d = new Date(dateStr);
    const date = d.getUTCDate();
    return Math.ceil(date / 7);
};

const getMachineType = (mName) => {
    if(state.machineConfig && state.machineConfig[mName]) {
        return state.machineConfig[mName];
    }
    let t = "Perfuratriz"; // fallback
    Object.values(state.data).forEach(arr => {
        if(Array.isArray(arr)) {
            const found = arr.find(x => x.maquina === mName);
            if(found) t = found.tipo;
        }
    });
    return t;
};

async function callGemini(prompt, isJson = false) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    if (isJson) payload.generationConfig = { responseMimeType: "application/json" };
    
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error("API Error");
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (error) {
        console.error("Gemini Error:", error);
        throw error;
    }
}

window.app = {
    aiTimeout: null,
    
    toggleTheme: () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.className = isLight 
                ? 'ph ph-moon text-3xl md:text-2xl mb-1 md:mb-0' 
                : 'ph ph-sun text-3xl md:text-2xl mb-1 md:mb-0';
        }
        
        app.updateDashboard();
        app.renderSettings();
    },

    navigate: (view, btn) => {
        document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`view-${view}`).classList.remove('hidden');
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        if(btn) btn.classList.add('active');
        
        if(view === 'settings') app.renderSettings();
        if(view === 'occurrences') app.renderOccurrences();
        if(view === 'overview') app.updateDashboard();
    },

    openModal: (id) => {
        const m = document.getElementById(id);
        if(!m) return;
        m.classList.remove('hidden');
        
        if(id === 'modal-entry' && !document.getElementById('in-id').value) {
            document.getElementById('in-id').value = ""; 
            document.getElementById('in-client').value = ""; 
            document.getElementById('in-value').value = "";
            const now = new Date(); 
            document.getElementById('in-date').value = now.toISOString().substring(0, 10);
            document.getElementById('in-dias-parados').value = "0"; 
            
            app.populateMachineSelect('in-machine', document.getElementById('in-tipo-cat').value);
            
            const inService = document.getElementById('in-service');
            if(inService) {
                inService.innerHTML = state.serviceTypes.map(s => `<option value="${s}">${s}</option>`).join('');
            }
            app.updateWeekLabel();
        }
    },
    
    closeModal: (id) => { 
        document.getElementById(id).classList.add('hidden'); 
        if(id === 'modal-entry') document.getElementById('in-id').value = ""; 
        if(id === 'modal-os') document.getElementById('os-id').value = "";
    },

    populateMachineSelect: (selectId, category = null) => {
        const select = document.getElementById(selectId);
        if(!select) return;
        
        let filteredMachines = state.machineTypes;
        if(category) {
            filteredMachines = state.machineTypes.filter(m => {
                if(!state.machineConfig || !state.machineConfig[m]) return true; 
                return state.machineConfig[m] === category;
            });
        }
        
        select.innerHTML = filteredMachines.map(m => `<option value="${m}">${m}</option>`).join('');
    },

    populateSelects: () => {
        app.populateMachineSelect('in-machine');
        app.populateMachineSelect('os-machine'); 
        app.populateMachineSelect('merge-keeper'); 
        app.populateMachineSelect('merge-loser'); 
        
        const inService = document.getElementById('in-service');
        if(inService) {
            inService.innerHTML = state.serviceTypes.map(s => `<option value="${s}">${s}</option>`).join('');
        }
    },

    updateWeekLabel: () => {
        const val = document.getElementById('in-date').value;
        if(val) { 
            const w = getWeekOfMonth(val); 
            document.getElementById('in-week-display').textContent = `S${w}`; 
        }
    },

    toggleDateInputs: () => {
        const mode = document.getElementById('view-granularity').value;
        if(mode === 'week') { 
            document.getElementById('container-date-range').classList.add('hidden'); 
            document.getElementById('container-date-single').classList.remove('hidden'); 
        } else { 
            document.getElementById('container-date-range').classList.remove('hidden'); 
            document.getElementById('container-date-single').classList.add('hidden'); 
        }
        app.updateDashboard();
    },

    // --- IA / GEMINI ---
    openAIChat: () => app.openModal('modal-ai-chat'),

    sendChatMessage: async () => {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if(!text) return;

        const history = document.getElementById('chat-history');
        const typing = document.getElementById('ai-typing');
        
        history.innerHTML += `<div class="chat-bubble chat-user">${text}</div>`;
        input.value = "";
        history.scrollTop = history.scrollHeight;
        typing.classList.remove('hidden');

        const contextData = {
            machines: state.machineTypes,
            services: state.serviceTypes,
            summary: Object.values(state.data).flat().slice(0, 20) 
        };

        const prompt = `
            Você é um assistente de Dashboard. Contexto: ${JSON.stringify(contextData)}
            Usuário: "${text}". Objetivo: JSON.
            1. 'insert_data': maquina, cliente, servico, valor, data.
            2. 'insert_batch': payload=[{maquina...}].
            3. 'add_setting': target, value.
            4. 'query': message.
        `;

        try {
            const result = await callGemini(prompt, true);
            typing.classList.add('hidden');
            let jsonStr = result.replace(/```json/g, "").replace(/```/g, "");
            const aiResponse = JSON.parse(jsonStr);
            
            let aiHtml = `<div class="chat-bubble chat-ai ai-content">${marked.parse(aiResponse.message || "")}</div>`;

            if(aiResponse.intent === 'insert_data') {
                const p = aiResponse.payload || {};
                aiHtml += `<div class="chat-bubble chat-ai bg-surface border border-border p-4"><ul class="text-sm space-y-2 mb-3"><li><b>Máq:</b> ${p.maquina||'?'}</li><li><b>Valor:</b> R$ ${p.valor}</li></ul><button onclick='app.confirmAIInsert(${JSON.stringify(p)})' class="w-full bg-status-success text-white text-sm font-bold py-3 rounded-lg">Confirmar</button></div>`;
            } else if (aiResponse.intent === 'insert_batch') {
                 aiHtml += `<div class="chat-bubble chat-ai bg-surface border border-border p-4"><p class="text-sm mb-3 text-txmain">Lote: <b>${aiResponse.payload.length}</b> itens.</p><button onclick='app.confirmAIBatchInsert(${JSON.stringify(aiResponse.payload)})' class="w-full bg-brand-main text-white text-sm font-bold py-3 rounded-lg">Importar</button></div>`;
            } else if(aiResponse.intent === 'add_setting') {
                const p = aiResponse.payload || {};
                aiHtml += `<div class="chat-bubble chat-ai bg-surface border border-border p-4"><p class="text-sm mb-3">Adicionar <b>"${p.value}"</b>?</p><button onclick='app.confirmAISetting("${p.target}", "${p.value}")' class="w-full bg-brand-main text-white text-sm font-bold py-3 rounded-lg">Confirmar</button></div>`;
            }

            history.innerHTML += aiHtml;
            history.scrollTop = history.scrollHeight;
        } catch(e) {
            typing.classList.add('hidden');
            history.innerHTML += `<div class="chat-bubble chat-ai text-status-danger">Erro na IA.</div>`;
        }
    },

    confirmAIInsert: async (data) => {
        const now = new Date();
        const mKey = state.months[now.getMonth()];
        const entry = { id: "IA_" + Date.now(), date: data.data || now.toISOString(), maquina: data.maquina || "Desconhecida", tipo: "Perfuratriz", cliente: data.cliente || "Avulso", servico: data.servico || "Geral", faturamento: parseFloat(data.valor) || 0, status: 'operando', diasParados: 0 };
        if(!state.data[mKey]) state.data[mKey] = [];
        state.data[mKey].push(entry);
        await setDoc(dbPath, { fullRawData: state.data }, { merge: true });
        app.updateDashboard();
        document.getElementById('chat-history').innerHTML += `<div class="chat-bubble chat-ai text-status-success">Salvo!</div>`;
    },

    confirmAIBatchInsert: async (items) => {
        let count = 0;
        for (const item of items) {
            let tipo = "Perfuratriz";
            const mUpper = (item.maquina || "").toUpperCase();
            if(mUpper.includes("BATE") || mUpper.includes("JUNTTAN")) tipo = "Bate-Estaca";
            if(mUpper.includes("BOMBA") || mUpper.includes("HBT")) tipo = "Bomba de Concreto";
            const dateObj = new Date(item.data); 
            if (isNaN(dateObj.getTime())) continue;
            
            const mKey = state.months[dateObj.getMonth()];
            const entry = { id: "IA_" + Date.now() + Math.random(), date: item.data, maquina: item.maquina || "Desconhecida", tipo, cliente: item.cliente || "Avulso", servico: item.servico || "Geral", faturamento: parseFloat(item.valor) || 0, status: 'operando', diasParados: 0 };
            if(!state.data[mKey]) state.data[mKey] = []; 
            state.data[mKey].push(entry); 
            count++;
        }
        await setDoc(dbPath, { fullRawData: state.data }, { merge: true });
        app.updateDashboard();
        document.getElementById('chat-history').innerHTML += `<div class="chat-bubble chat-ai text-status-success">Importados: ${count}!</div>`;
    },

    confirmAISetting: async (target, value) => { 
        state[target].push(value); 
        await setDoc(dbPath, {[target]: state[target]}, {merge:true}); 
        app.renderSettings(); 
    },

    // --- LÓGICA DE ORDEM DE SERVIÇO (OS) ---
    openModalOS: () => {
        document.getElementById('os-id').value = "";
        document.getElementById('os-date').value = new Date().toISOString().substring(0, 7);
        document.getElementById('os-status').value = "Em Progresso";
        document.getElementById('os-reason').value = "manutencao";
        document.getElementById('os-obra').value = "";
        document.getElementById('os-days').value = "1";
        document.getElementById('os-obs').value = "";
        document.getElementById('os-number-display').textContent = "OS-" + Math.floor(Math.random() * 90000 + 10000);
        
        app.populateMachineSelect('os-machine');
        
        const tbody = document.getElementById('os-items-body');
        tbody.innerHTML = '';
        app.addOsItemRow('Revisão / Peça', 1, 0);
        
        app.openModal('modal-os');
    },

    addOsItemRow: (desc='', qty=1, price=0) => {
        const tbody = document.getElementById('os-items-body');
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-base/50 transition-colors";
        
        const formatBR = (val) => val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        
        tr.innerHTML = `
            <td class="p-2"><input type="text" class="os-desc bg-transparent border-b border-border text-txmain p-2 w-full outline-none focus:border-brand-main text-sm" placeholder="Ex: Correia" value="${desc}"></td>
            <td class="p-2"><input type="number" min="1" class="os-qty bg-transparent border-b border-border text-txmain p-2 w-full outline-none focus:border-brand-main text-center text-sm" value="${qty}" onchange="app.calcOsTotal()" onkeyup="app.calcOsTotal()"></td>
            <td class="p-2 relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-txmuted text-xs">R$</span><input type="number" step="0.01" class="os-price bg-transparent border-b border-border text-txmain p-2 pl-8 w-full outline-none focus:border-brand-main text-right text-sm" value="${price}" onchange="app.calcOsTotal()" onkeyup="app.calcOsTotal()"></td>
            <td class="p-2 text-right os-row-total text-txmain font-mono text-sm font-bold">${formatBR(qty*price)}</td>
            <td class="p-2 text-center"><button onclick="this.closest('tr').remove(); app.calcOsTotal()" class="w-8 h-8 rounded text-txmuted hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors"><i class="ph-bold ph-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
        app.calcOsTotal();
    },

    calcOsTotal: () => {
        const tbody = document.getElementById('os-items-body');
        let totalGlobal = 0;
        
        Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
            const qty = parseFloat(tr.querySelector('.os-qty').value) || 0;
            const price = parseFloat(tr.querySelector('.os-price').value) || 0;
            const total = qty * price;
            tr.querySelector('.os-row-total').textContent = total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
            totalGlobal += total;
        });
        
        document.getElementById('os-total-val').textContent = totalGlobal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        return totalGlobal;
    },

    saveOS: async () => {
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
            totalValue: app.calcOsTotal()
        };

        if(existingId) {
            state.occurrences = state.occurrences.filter(o => o.id !== existingId);
        }
        state.occurrences.push(entry);
        await setDoc(dbPath, { occurrences: state.occurrences }, { merge: true });

        app.closeModal('modal-os');
        app.renderOccurrences();
        app.updateDashboard();
    },

    editOS: (id) => {
        const os = state.occurrences.find(o => o.id === id);
        if(!os) return;
        
        app.populateMachineSelect('os-machine');
        
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
        tbody.innerHTML = '';
        
        if(os.items && os.items.length > 0) {
            os.items.forEach(i => app.addOsItemRow(i.desc, i.qty, i.price));
        } else {
            app.addOsItemRow('Serviço / Manutenção Global', 1, os.totalValue || 0);
        }
        
        app.openModal('modal-os');
    },

    renderOccurrences: () => {
        const searchMac = document.getElementById('occ-search-machine').value.toLowerCase();
        const searchObra = document.getElementById('occ-search-obra').value.toLowerCase();
        const list = document.getElementById('occ-list');
        
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
                        <span class="font-mono font-bold text-status-success">R$ ${totalOS.toLocaleString()}</span>
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
    },

    // --- FUSÃO (MERGE) DE MÁQUINAS ---
    openMergeModal: () => {
        app.populateSelects(); 
        app.openModal('modal-merge');
    },

    executeMerge: async () => {
        const keeper = document.getElementById('merge-keeper').value;
        const loser = document.getElementById('merge-loser').value;
        
        if(!keeper || !loser) return alert("Selecione ambas as máquinas.");
        if(keeper === loser) return alert("As máquinas para fusão não podem ser a mesma.");

        Object.keys(state.data).forEach(m => {
            if(Array.isArray(state.data[m])) {
                state.data[m].forEach(d => {
                    if(d.maquina === loser) d.maquina = keeper;
                });
            }
        });

        state.occurrences.forEach(o => {
            if(o.machine === loser) o.machine = keeper;
        });

        state.machineTypes = state.machineTypes.filter(m => m !== loser);
        if(state.machineConfig && state.machineConfig[loser]) {
            delete state.machineConfig[loser];
        }

        await setDoc(dbPath, { 
            fullRawData: state.data, 
            occurrences: state.occurrences, 
            machineTypes: state.machineTypes, 
            machineConfig: state.machineConfig 
        }, { merge: true });

        app.closeModal('modal-merge');
        app.renderSettings();
        app.renderOccurrences();
        app.updateDashboard();
        
        alert(`Sucesso! Os dados da máquina "${loser}" foram fundidos na máquina "${keeper}".`);
    },

    // --- LÓGICA DE SALVAR FINANCEIRO ---
    saveEntry: async () => {
        try {
            const existingId = document.getElementById('in-id').value;
            const dateVal = document.getElementById('in-date').value;
            if(!dateVal) return alert("Selecione uma data!");
            
            if (!auth.currentUser) await signInAnonymously(auth);

            const dateObj = new Date(dateVal + 'T12:00:00');
            const mKey = state.months[dateObj.getMonth()];
            const entry = { 
                id: existingId || "ID_" + Date.now(), 
                date: dateObj.toISOString(), 
                maquina: document.getElementById('in-machine').value, 
                tipo: document.getElementById('in-tipo-cat').value, 
                cliente: document.getElementById('in-client').value || 'Avulso', 
                servico: document.getElementById('in-service').value, 
                faturamento: parseFloat(document.getElementById('in-value').value) || 0, 
                status: document.getElementById('in-status').value, 
                diasParados: parseInt(document.getElementById('in-dias-parados').value) || 0 
            };
            
            Object.keys(state.data).forEach(month => { 
                if (Array.isArray(state.data[month])) { 
                    state.data[month] = state.data[month].filter(d => d.id !== entry.id); 
                } 
            });
            if(!state.data[mKey]) state.data[mKey] = [];
            state.data[mKey].push(entry);
            
            await setDoc(dbPath, { fullRawData: state.data }, { merge: true });
            
            const feedback = document.getElementById('save-feedback'); 
            feedback.style.opacity = '1'; 
            setTimeout(() => { feedback.style.opacity = '0'; }, 2000);
            
            if(existingId) app.closeModal('modal-entry'); 
            app.updateDashboard();
            
            const modalList = document.getElementById('modal-drill-list');
            if(!modalList.classList.contains('hidden')) app.closeModal('modal-drill-list'); 
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar dados. Verifique sua conexão. " + error.message);
        }
    },
    
    updateDashboard: () => {
        const search = document.getElementById('global-search').value.toLowerCase();
        const typeFilter = document.getElementById('filter-type').value;
        const granularity = document.getElementById('view-granularity').value;
        const weekFilter = document.getElementById('filter-week-num').value;
        
        let sDate, eDate;
        if (granularity === 'week') { 
            const singleDate = document.getElementById('date-single').value; 
            sDate = singleDate; eDate = singleDate; 
        } else { 
            sDate = document.getElementById('date-start').value; 
            eDate = document.getElementById('date-end').value; 
        }
        
        let filtered = [];
        Object.values(state.data).forEach(mArr => {
            if(Array.isArray(mArr)) {
                mArr.forEach(d => {
                    const dM = d.date.substring(0, 7);
                    if(dM >= sDate && dM <= eDate) {
                        let matchesWeek = true;
                        if (granularity === 'week' && weekFilter !== 'all') { 
                            if (getWeekOfMonth(d.date).toString() !== weekFilter) { matchesWeek = false; } 
                        }
                        if(matchesWeek) { 
                            if((!search || d.maquina.toLowerCase().includes(search) || d.cliente.toLowerCase().includes(search)) && (typeFilter === 'all' || d.tipo === typeFilter)) { 
                                filtered.push(d); 
                            } 
                        }
                    }
                });
            }
        });
        
        const total = filtered.reduce((acc, i) => acc + i.faturamento, 0);
        const perf = filtered.filter(i => i.tipo === 'Perfuratriz').reduce((acc, i) => acc + i.faturamento, 0);
        const bate = filtered.filter(i => i.tipo === 'Bate-Estaca').reduce((acc, i) => acc + i.faturamento, 0);
        const bomba = filtered.filter(i => i.tipo === 'Bomba de Concreto').reduce((acc, i) => acc + i.faturamento, 0);
        
        document.getElementById('kpi-total').textContent = total.toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
        document.getElementById('kpi-perf').textContent = perf.toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
        document.getElementById('kpi-bate').textContent = bate.toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
        document.getElementById('kpi-bomba').textContent = bomba.toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
        
        app.renderCharts(filtered, sDate, eDate, search, typeFilter);
        
        if(app.aiTimeout) clearTimeout(app.aiTimeout);
        app.aiTimeout = setTimeout(() => { app.openAIAnalysis(filtered); }, 1000);
    },
    
    // --- GRÁFICOS & INTERATIVIDADE ---
    renderCharts: (data, sDate, eDate, search, typeFilter) => {
        const machineAgg = data.reduce((acc, i) => { 
            if(!acc[i.maquina]) acc[i.maquina] = { val: 0, tipo: i.tipo }; 
            acc[i.maquina].val += i.faturamento; 
            return acc; 
        }, {});
        const mLabels = Object.keys(machineAgg).sort((a,b) => machineAgg[b].val - machineAgg[a].val);
        app.drawChart('chart-production', 'bar', mLabels, mLabels.map(l => machineAgg[l].val), mLabels.map(l => state.colorMap[machineAgg[l].tipo]));
        
        const sAgg = data.reduce((acc, i) => { acc[i.servico] = (acc[i.servico]||0)+i.faturamento; return acc; }, {});
        const sLabels = Object.keys(sAgg);
        const sColors = sLabels.map((s, idx) => state.serviceColors[s] || state.defaultPalette[idx % state.defaultPalette.length]);
        app.drawChart('chart-service', 'doughnut', sLabels, Object.values(sAgg), sColors);
        
        const clientAgg = data.reduce((acc, i) => { acc[i.cliente] = (acc[i.cliente]||0)+i.faturamento; return acc; }, {});
        const cLabels = Object.keys(clientAgg).sort((a,b) => clientAgg[b] - clientAgg[a]).slice(0, 10);
        app.drawChart('chart-clients', 'bar', cLabels, cLabels.map(l => clientAgg[l]), '#10b981', true);
        
        const granularity = document.getElementById('view-granularity').value;
        const weekFilter = document.getElementById('filter-week-num').value;
        const trend = data.reduce((acc, i) => { 
            let key; 
            if (granularity === 'week') { 
                if (weekFilter === 'all') { 
                    const weekNum = getWeekOfMonth(i.date); 
                    key = `S${weekNum}`; 
                } else { 
                    const dObj = new Date(i.date); 
                    key = `${dObj.getUTCDate()}/${dObj.getUTCMonth() + 1}`; 
                } 
            } else { 
                key = i.date.substring(0, 7); 
            } 
            acc[key] = (acc[key]||0)+i.faturamento; 
            return acc; 
        }, {});
        const sortedKeys = Object.keys(trend).sort();
        app.drawChart('chart-trend', 'line', sortedKeys, sortedKeys.map(l => trend[l]), getCssVar('--brand-main') || '#dc2626');
        
        const servRent = data.reduce((acc, i) => { 
            if(!acc[i.servico]) acc[i.servico] = { sum: 0, count: 0 }; 
            acc[i.servico].sum += i.faturamento; 
            acc[i.servico].count++; 
            return acc; 
        }, {});
        const rLabels = Object.keys(servRent);
        const rColors = rLabels.map(s => state.serviceColors[s] || state.defaultPalette[0]); 
        app.drawChart('chart-profitability', 'bar', rLabels, rLabels.map(l => servRent[l].sum / servRent[l].count), rColors);
        
        const idleAgg = {};
        state.occurrences.forEach(occ => {
            if(occ.date >= sDate && occ.date <= eDate) {
                const mType = getMachineType(occ.machine);
                if((typeFilter === 'all' || mType === typeFilter) && (!search || occ.machine.toLowerCase().includes(search))) {
                    idleAgg[occ.machine] = (idleAgg[occ.machine]||0) + occ.days;
                }
            }
        });
        data.forEach(i => {
            if(i.diasParados > 0) { idleAgg[i.maquina] = (idleAgg[i.maquina]||0) + i.diasParados; }
        });

        const iLabels = Object.keys(idleAgg).sort((a,b) => idleAgg[b] - idleAgg[a]); 
        app.drawChart('chart-idle', 'bar', iLabels, iLabels.map(l => idleAgg[l]), '#ef4444');
    },

    drawChart: (id, type, labels, values, colors, horizontal = false) => {
        const canvas = document.getElementById(id); 
        if(!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if(state.charts[id]) state.charts[id].destroy();
        
        const textColor = getCssVar('--text-muted');
        const gridColor = getCssVar('--border-color');
        
        Chart.defaults.color = textColor; 
        Chart.defaults.borderColor = gridColor;
        
        let datasetConfig = { 
            data: values, 
            backgroundColor: colors, 
            borderRadius: 6, 
            fill: type === 'line', 
            tension: 0.4 
        };
        
        const options = { 
            indexAxis: horizontal ? 'y' : 'x', 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: type === 'doughnut', labels: { boxWidth: 14, font: { size: 13 }, color: textColor } },
                datalabels: { display: false }
            }, 
            scales: {},
            onClick: (e, elements, chart) => {
                if (elements[0]) {
                    const i = elements[0].index;
                    const label = chart.data.labels[i];
                    app.handleChartClick(id, label);
                }
            }
        };

        if (type === 'line') { 
            const brandRgb = getCssVar('--brand-glow') || 'rgba(220, 38, 38, 0.4)'; 
            const gradient = ctx.createLinearGradient(0, 0, 0, 300); 
            gradient.addColorStop(0, brandRgb); 
            gradient.addColorStop(1, 'rgba(220, 38, 38, 0)'); 
            datasetConfig.backgroundColor = gradient; 
            datasetConfig.borderColor = getCssVar('--brand-main') || '#dc2626'; 
            datasetConfig.pointRadius = 5; 
            datasetConfig.pointBackgroundColor = getCssVar('--bg-surface') || '#ffffff'; 
            datasetConfig.pointBorderColor = getCssVar('--brand-main') || '#dc2626'; 
            datasetConfig.pointBorderWidth = 2; 
            datasetConfig.pointHoverRadius = 7;
        }
        
        if (type === 'doughnut') {
            datasetConfig.borderWidth = 2; 
            datasetConfig.borderColor = getCssVar('--bg-surface'); 
            datasetConfig.hoverOffset = 12; 
            options.plugins.tooltip = { 
                enabled: true, 
                bodyFont: {size: 14}, 
                titleFont: {size: 14}, 
                callbacks: { 
                    label: function(context) { 
                        let label = context.label || ''; 
                        if (label) { label += ': '; } 
                        let value = context.parsed; 
                        let total = context.chart._metasets[context.datasetIndex].total; 
                        let percentage = (value * 100 / total).toFixed(1) + "%"; 
                        return label + value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) + " (" + percentage + ")"; 
                    } 
                } 
            };
        } else {
            options.scales = { 
                y: { grid: { color: gridColor }, ticks: { font: { size: 12 }, color: textColor } }, 
                x: { grid: { display: false }, ticks: { font: { size: 12 }, color: textColor, autoSkip: false, maxRotation: 45, minRotation: 0 } } 
            };
            options.plugins.tooltip = { bodyFont: {size: 14}, titleFont: {size: 14} };
        }

        state.charts[id] = new Chart(canvas, { type: type, data: { labels, datasets: [datasetConfig] }, options: options });
    },

    handleChartClick: (chartId, label) => {
        let filterFn = null;
        let title = label;

        if (chartId === 'chart-production') {
            filterFn = (d) => d.maquina === label;
            title = `Máquina: ${label}`;
        } else if (chartId === 'chart-service') {
            filterFn = (d) => d.servico === label;
            title = `Serviço: ${label}`;
        } else if (chartId === 'chart-trend') {
            title = `Período: ${label}`;
            const granularity = document.getElementById('view-granularity').value;
            if(granularity === 'week') {
                 if(label.startsWith('S')) {
                     const w = label.replace('S', '');
                     filterFn = (d) => getWeekOfMonth(d.date).toString() === w;
                 } else {
                     filterFn = (d) => {
                         const dObj = new Date(d.date);
                         const k = `${dObj.getUTCDate()}/${dObj.getUTCMonth() + 1}`;
                         return k === label;
                     };
                 }
            } else {
                filterFn = (d) => d.date.substring(0, 7) === label;
            }
        } else if (chartId === 'chart-clients') {
            filterFn = (d) => d.cliente === label;
            title = `Cliente: ${label}`;
        } else {
            return; 
        }

        app.openDrillModal(title, filterFn);
    },

    openDrillModal: (title, filterFn) => {
        let allData = [];
        Object.values(state.data).forEach(arr => allData.push(...arr));
        const clickedData = allData.filter(filterFn);
        clickedData.sort((a,b) => new Date(b.date) - new Date(a.date));

        document.getElementById('drill-list-title').textContent = title;
        const tbody = document.getElementById('drill-list-body');
        
        if (clickedData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-5 text-center text-txmuted text-base">Nenhum registro encontrado.</td></tr>';
        } else {
            tbody.innerHTML = clickedData.map(d => `
                <tr class="border-b border-border hover:bg-panel transition-colors">
                    <td class="p-4 text-txmuted font-mono text-sm">${new Date(d.date).toLocaleDateString()}</td>
                    <td class="p-4 text-txmain font-bold text-sm md:text-base">${d.maquina}</td>
                    <td class="p-4 text-txmain text-sm md:text-base">${d.cliente}</td>
                    <td class="p-4 text-right text-status-success font-mono text-sm md:text-base font-bold">R$ ${d.faturamento.toLocaleString()}</td>
                    <td class="p-4 text-center flex justify-center gap-3">
                        <button onclick="app.editEntry('${d.id}')" class="w-10 h-10 rounded-lg bg-brand-light/20 text-brand-main hover:bg-brand-main hover:text-white flex items-center justify-center transition-colors" title="Editar">
                            <i class="ph-bold ph-pencil-simple text-lg"></i>
                        </button>
                        <button onclick="app.deleteEntry('${d.id}')" class="w-10 h-10 rounded-lg bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors" title="Excluir">
                            <i class="ph-bold ph-trash text-lg"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
        app.openModal('modal-drill-list');
    },

    expandChart: (type) => { 
        app.openModal('modal-expand'); 
        const key = type === 'production' ? 'maquina' : 'servico'; 
        let filtered = Object.values(state.data).flat(); 
        
        const agg = filtered.reduce((acc, i) => { 
            if(!acc[i[key]]) acc[i[key]] = { val: 0, tipo: i.tipo }; 
            acc[i[key]].val += i.faturamento; 
            return acc; 
        }, {}); 
        
        const labels = Object.keys(agg).sort((a,b) => agg[b].val - agg[a].val); 
        
        document.getElementById('expand-table-body').innerHTML = labels.map((k, i) => `
            <tr class="cursor-pointer hover:bg-base transition-colors" onclick="app.showDrill('${k}', '${key}')">
                <td class="p-4 border-b border-border text-txmain font-bold text-sm flex justify-between">
                    <span>${i+1}. ${k}</span> <i class="ph-bold ph-caret-right text-txmuted"></i>
                </td>
                <td class="p-4 border-b border-border text-right text-brand-main font-mono text-sm font-bold">
                    R$ ${agg[k].val.toLocaleString()}
                </td>
            </tr>
        `).join(''); 
        
        app.drawChart('chart-expanded', 'bar', labels, labels.map(l => agg[l].val), labels.map(l => type === 'production' ? state.colorMap[agg[l].tipo] : (state.serviceColors[l] || state.defaultPalette[labels.indexOf(l) % state.defaultPalette.length]))); 
    },

    showDrill: (val, key) => { 
        document.getElementById('drill-down-container').classList.remove('hidden'); 
        document.getElementById('drill-title').textContent = val; 
        
        let filtered = Object.values(state.data).flat().filter(d => d[key] === val); 
        
        document.getElementById('drill-table-body').innerHTML = filtered.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(d => `
            <tr class="border-b border-border hover:bg-base transition-colors">
                <td class="p-4 text-txmuted font-mono text-sm">${new Date(d.date).toLocaleDateString()}</td>
                <td class="p-4 text-txmain font-bold text-sm">${d.cliente}</td>
                <td class="p-4 text-right text-status-success font-mono text-sm font-bold">R$ ${d.faturamento.toLocaleString()}</td>
                <td class="p-4 text-center flex justify-center gap-3">
                     <button onclick="app.editEntry('${d.id}')" class="text-brand-main hover:text-brand-hover transition-colors"><i class="ph-bold ph-pencil-simple text-xl"></i></button>
                     <button onclick="app.deleteEntry('${d.id}')" class="text-txmuted hover:text-red-500 transition-colors"><i class="ph-bold ph-trash text-xl"></i></button>
                </td>
            </tr>
        `).join(''); 
    },

    closeDrillDown: () => document.getElementById('drill-down-container').classList.add('hidden'),
    
    openAIAnalysis: async (data) => {
        const elTextReview = document.getElementById('ai-text-review');
        if(!data.length) { 
            elTextReview.innerHTML = "Sem dados suficientes para análise."; 
            return; 
        }

        const total = data.reduce((acc, i) => acc + i.faturamento, 0); 
        const avg = total / data.length; 
        elTextReview.innerHTML = `<span class="flex items-center gap-3 ai-thinking text-lg"><i class="ph ph-spinner animate-spin text-2xl"></i> Gemini está analisando...</span>`;
        
        let growthVal = "--", growthDesc = "Aguardando mais dados";
        if (data.length > 5) {
            const mid = Math.floor(data.length / 2);
            const oldPart = data.slice(0, mid).reduce((a,b)=>a+b.faturamento,0) / mid;
            const newPart = data.slice(mid).reduce((a,b)=>a+b.faturamento,0) / (data.length - mid);
            const diff = newPart - oldPart;
            const pct = oldPart > 0 ? (diff / oldPart) * 100 : 0;
            growthVal = (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
            growthDesc = pct > 0 ? "Crescimento recente" : "Desaceleração";
            document.getElementById('ai-widget-growth-val').textContent = growthVal;
            document.getElementById('ai-widget-growth-desc').textContent = growthDesc;
            document.getElementById('ai-widget-growth-val').className = pct >= 0 ? "text-3xl font-bold text-emerald-500 mb-1" : "text-3xl font-bold text-red-500 mb-1";
        }
        
        const dailySum = data.reduce((acc, curr) => { 
            const date = curr.date.substring(0, 10); 
            acc[date] = (acc[date] || 0) + curr.faturamento; 
            return acc; 
        }, {});
        
        let bestDay = { date: '-', val: 0 };
        for (const [date, val] of Object.entries(dailySum)) { 
            if (val > bestDay.val) bestDay = { date, val }; 
        }
        
        if (bestDay.val > 0) {
            const bdParts = bestDay.date.split('-');
            document.getElementById('ai-widget-peak-val').textContent = `Dia ${bdParts[2]}`;
            document.getElementById('ai-widget-peak-desc').textContent = `R$ ${bestDay.val.toLocaleString('pt-BR',{maximumFractionDigits:0})}`;
        }

        const projection = total > 0 ? total * 1.15 : 0;
        document.getElementById('ai-widget-forecast-val').textContent = projection.toLocaleString('pt-BR',{style:'currency',currency:'BRL', maximumFractionDigits:0});

        const clientSum = data.reduce((acc, curr) => { 
            acc[curr.cliente] = (acc[curr.cliente] || 0) + curr.faturamento; 
            return acc; 
        }, {});
        
        const topClients = Object.entries(clientSum).sort(([,a], [,b]) => b - a).slice(0, 3);
        document.getElementById('ai-top-list').innerHTML = topClients.map((item, idx) => `
            <div class="flex justify-between items-center bg-panel p-4 rounded-xl border border-border">
                <span class="text-sm text-txmain font-bold flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-500 flex items-center justify-center text-xs">${idx+1}</span> ${item[0]}
                </span>
                <span class="text-sm text-emerald-500 font-mono font-bold">${item[1].toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0})}</span>
            </div>
        `).join('');

        try {
            const prompt = `Faça um resumo analítico para um diretor de empresa de engenharia de fundações baseando-se nestes dados em no máximo 3 linhas (Markdown curto e direto). Faturamento total do período: R$ ${total.toFixed(2)}, Ticket médio por serviço: R$ ${avg.toFixed(2)}. Foque em insight de negócio.`;
            const aiResponse = await callGemini(prompt, false); 
            elTextReview.innerHTML = marked.parse(aiResponse);
        } catch (e) { 
            elTextReview.innerHTML = "Inteligência Artificial temporariamente indisponível."; 
        }
    },

    openAIDeepDive: () => { 
        app.openModal('modal-ai-deep-dive'); 
        const allData = Object.values(state.data).flat(); 
        app.openAIAnalysis(allData); 
    },

    renderSettings: () => { 
        const drawMachine = (id, list) => {
            document.getElementById(id).innerHTML = list.map((item, idx) => {
                const mType = state.machineConfig[item] || "Não Classificado";
                return `
                <li class="flex justify-between items-center bg-panel p-4 rounded-xl border border-border shadow-sm hover:shadow-md transition-all">
                    <div>
                        <span class="text-base font-bold text-txmain" style="color: var(--text-main);">${item}</span>
                        <span class="text-xs ml-2 px-2 py-1 bg-brand-light/20 text-brand-main rounded-md">${mType}</span>
                    </div>
                    <div class="flex gap-4">
                        <button onclick="app.editSettingItem('machineTypes', ${idx})" class="text-brand-main hover:text-brand-hover"><i class="ph-bold ph-pencil-simple text-xl"></i></button>
                        <button onclick="app.removeSettingItem('machineTypes', ${idx})" class="text-red-500 hover:text-red-700"><i class="ph-bold ph-trash text-xl"></i></button>
                    </div>
                </li>`;
            }).join('');
        };
        
        const drawServices = (id, list) => {
            document.getElementById(id).innerHTML = list.map((item, idx) => `
            <li class="flex justify-between items-center bg-panel p-4 rounded-xl border border-border shadow-sm hover:shadow-md transition-all">
                <div class="flex items-center gap-4">
                    <input type="color" value="${state.serviceColors[item] || state.defaultPalette[idx % state.defaultPalette.length]}" onchange="app.updateServiceColor('${item}', this.value)" class="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent p-0">
                    <span class="text-base font-bold text-txmain" style="color: var(--text-main);">${item}</span>
                </div>
                <div class="flex gap-4">
                    <button onclick="app.editSettingItem('serviceTypes', ${idx})" class="text-brand-main hover:text-brand-hover"><i class="ph-bold ph-pencil-simple text-xl"></i></button>
                    <button onclick="app.removeSettingItem('serviceTypes', ${idx})" class="text-red-500 hover:text-red-700"><i class="ph-bold ph-trash text-xl"></i></button>
                </div>
            </li>`).join('');
        };
        
        drawMachine('list-machines', state.machineTypes); 
        drawServices('list-services', state.serviceTypes); 
    },
    
    addSettingItem: async (type) => {
        let inputId = type === 'machineTypes' ? 'setting-new-machine' : 'setting-new-service';
        const val = document.getElementById(inputId).value.trim();
        
        if(val) {
            state[type].push(val);
            document.getElementById(inputId).value = ""; 
            
            const updates = { [type]: state[type] };
            
            if(type === 'machineTypes') {
                const mType = document.getElementById('setting-new-machine-type').value;
                if(!state.machineConfig) state.machineConfig = {};
                state.machineConfig[val] = mType;
                updates.machineConfig = state.machineConfig;
            }

            await setDoc(dbPath, updates, {merge:true}); 
            app.renderSettings(); 
        }
    },
    
    editSettingItem: (type, idx) => {
        const oldName = state[type][idx];
        state.tempPrompt = { type, idx, oldName };
        document.getElementById('modal-prompt-title').textContent = `Renomear "${oldName}"`;
        document.getElementById('modal-prompt-input').value = oldName;
        document.getElementById('modal-prompt').classList.remove('hidden');
    },
    
    executePrompt: async () => {
        const newName = document.getElementById('modal-prompt-input').value.trim();
        const { type, idx, oldName } = state.tempPrompt;
        
        if (newName && newName !== oldName) {
            state[type][idx] = newName;
            
            if (type === 'serviceTypes' && state.serviceColors[oldName]) {
                state.serviceColors[newName] = state.serviceColors[oldName];
                delete state.serviceColors[oldName];
            }

            if (type === 'machineTypes' && state.machineConfig[oldName]) {
                state.machineConfig[newName] = state.machineConfig[oldName];
                delete state.machineConfig[oldName];
            }

            Object.keys(state.data).forEach(month => {
                if (Array.isArray(state.data[month])) {
                    state.data[month].forEach(entry => {
                        if (type === 'serviceTypes' && entry.servico === oldName) entry.servico = newName;
                        if (type === 'machineTypes' && entry.maquina === oldName) entry.maquina = newName;
                    });
                }
            });

            if(type === 'machineTypes') {
                state.occurrences.forEach(occ => {
                    if(occ.machine === oldName) occ.machine = newName;
                });
            }

            const updates = { [type]: state[type], fullRawData: state.data, occurrences: state.occurrences };
            if (type === 'serviceTypes') updates.serviceColors = state.serviceColors;
            if (type === 'machineTypes') updates.machineConfig = state.machineConfig;

            await setDoc(dbPath, updates, { merge: true });
            app.renderSettings();
            app.renderOccurrences();
            app.updateDashboard();
        }
        document.getElementById('modal-prompt').classList.add('hidden');
    },

    removeSettingItem: (type, idx) => {
        state.tempConfirm = { type: 'setting', settingType: type, idx: idx };
        document.getElementById('modal-confirm').classList.remove('hidden');
    },

    deleteEntry: (id, contextType = 'entry') => { 
        state.tempConfirm = { type: contextType, id: id };
        document.getElementById('modal-confirm').classList.remove('hidden');
    },

    editEntry: (id) => {
        let found = null;
        Object.values(state.data).forEach(m => { 
            const d = m.find(i => i.id === id); 
            if(d) found = d; 
        });
        if(!found) return;

        document.getElementById('in-id').value = found.id; 
        document.getElementById('in-client').value = found.cliente; 
        document.getElementById('in-value').value = found.faturamento; 
        document.getElementById('in-date').value = found.date.substring(0, 10); 
        document.getElementById('in-tipo-cat').value = found.tipo; 
        
        app.populateSelects(); 
        
        document.getElementById('in-machine').value = found.maquina; 
        document.getElementById('in-service').value = found.servico; 
        document.getElementById('in-status').value = found.status; 
        document.getElementById('in-dias-parados').value = found.diasParados || 0; 
        
        app.updateWeekLabel(); 
        app.closeModal('modal-drill-list');
        app.openModal('modal-entry');
    },

    executeConfirm: async () => {
        const target = state.tempConfirm;
        if(!target) return;

        if (target.type === 'setting') {
            const removedName = state[target.settingType][target.idx];
            state[target.settingType].splice(target.idx, 1);
            
            if(target.settingType === 'machineTypes' && state.machineConfig[removedName]) {
                delete state.machineConfig[removedName];
            }

            await setDoc(dbPath, {
                [target.settingType]: state[target.settingType],
                machineConfig: state.machineConfig
            }, {merge:true});
            app.renderSettings();
            
        } else if (target.type === 'entry') {
            Object.keys(state.data).forEach(m => { 
                if(Array.isArray(state.data[m])) state.data[m] = state.data[m].filter(d => d.id !== target.id); 
            }); 
            await setDoc(dbPath, { fullRawData: state.data }, { merge: true }); 
            app.updateDashboard(); 
            const list = document.getElementById('modal-drill-list'); 
            if(!list.classList.contains('hidden')) app.closeModal('modal-drill-list');
            
        } else if (target.type === 'occurrence') {
            state.occurrences = state.occurrences.filter(o => o.id !== target.id);
            await setDoc(dbPath, { occurrences: state.occurrences }, { merge: true });
            app.renderOccurrences();
            app.updateDashboard();
        }
        
        document.getElementById('modal-confirm').classList.add('hidden');
    },

    updateServiceColor: async (service, color) => { 
        state.serviceColors[service] = color; 
        await setDoc(dbPath, { serviceColors: state.serviceColors }, { merge: true }); 
        app.updateDashboard(); 
    },
};

document.addEventListener("DOMContentLoaded", () => {
    if(localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.className = 'ph ph-moon text-3xl md:text-2xl mb-1 md:mb-0';
    }
});

onAuthStateChanged(auth, user => {
    if(user) {
        onSnapshot(dbPath, (snap) => {
            if(snap.exists()) {
                const d = snap.data();
                state.data = d.fullRawData || {};
                state.occurrences = d.occurrences || []; 
                state.machineTypes = d.machineTypes || state.machineTypes;
                state.machineConfig = d.machineConfig || {}; 
                state.serviceTypes = d.serviceTypes || state.serviceTypes;
                state.serviceColors = d.serviceColors || state.serviceColors; 
                
                const dot = document.getElementById('db-status-dot');
                if(dot) dot.className = "w-3 h-3 rounded-full bg-emerald-500 shadow-glow";
                
                app.updateDashboard();
                if(!document.getElementById('view-occurrences').classList.contains('hidden')) {
                    app.renderOccurrences();
                }
            }
        });
    } else { 
        signInAnonymously(auth); 
    }
});

// Inicializar Datas Padrão
setTimeout(() => {
    const today = new Date().toISOString().substring(0, 7);
    const dateStart = document.getElementById('date-start');
    const dateEnd = document.getElementById('date-end');
    const dateSingle = document.getElementById('date-single');
    
    if(dateStart) dateStart.value = today;
    if(dateEnd) dateEnd.value = today;
    if(dateSingle) dateSingle.value = today;
}, 100);