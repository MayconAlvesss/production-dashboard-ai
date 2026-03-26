import { state } from '../state/store.js';
import { dbPath, setDoc } from '../config/firebase.js';

export const renderSettings = () => { 
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
};

export const addSettingItem = async (type) => {
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
        window.app.renderSettings(); 
    }
};

export const editSettingItem = (type, idx) => {
    const oldName = state[type][idx];
    state.tempPrompt = { type, idx, oldName };
    document.getElementById('modal-prompt-title').textContent = `Renomear "${oldName}"`;
    document.getElementById('modal-prompt-input').value = oldName;
    document.getElementById('modal-prompt').classList.remove('hidden');
};

export const removeSettingItem = (type, idx) => {
    state.tempConfirm = { type: 'setting', settingType: type, idx: idx };
    document.getElementById('modal-confirm').classList.remove('hidden');
};

export const executePrompt = async () => {
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
        window.app.renderSettings();
        window.app.renderOccurrences();
        window.app.updateDashboard();
    }
    document.getElementById('modal-prompt').classList.add('hidden');
};

export const executeConfirm = async () => {
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
        window.app.renderSettings();
        
    } else if (target.type === 'entry') {
        Object.keys(state.data).forEach(m => { 
            if(Array.isArray(state.data[m])) state.data[m] = state.data[m].filter(d => d.id !== target.id); 
        }); 
        await setDoc(dbPath, { fullRawData: state.data }, { merge: true }); 
        window.app.updateDashboard(); 
        const list = document.getElementById('modal-drill-list'); 
        if(list && !list.classList.contains('hidden')) window.app.closeModal('modal-drill-list');
        
    } else if (target.type === 'occurrence') {
        state.occurrences = state.occurrences.filter(o => o.id !== target.id);
        await setDoc(dbPath, { occurrences: state.occurrences }, { merge: true });
        window.app.renderOccurrences();
        window.app.updateDashboard();
    }
    
    document.getElementById('modal-confirm').classList.add('hidden');
};

export const updateServiceColor = async (service, color) => { 
    state.serviceColors[service] = color; 
    await setDoc(dbPath, { serviceColors: state.serviceColors }, { merge: true }); 
    window.app.updateDashboard(); 
};

export const openMergeModal = () => {
    window.app.populateSelects(); 
    window.app.openModal('modal-merge');
};

export const executeMerge = async () => {
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

    window.app.closeModal('modal-merge');
    window.app.renderSettings();
    window.app.renderOccurrences();
    window.app.updateDashboard();
    
    alert(`Sucesso! Os dados da máquina "${loser}" foram fundidos na máquina "${keeper}".`);
};
