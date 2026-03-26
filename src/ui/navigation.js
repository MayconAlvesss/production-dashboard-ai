import { state } from '../state/store.js';
import { getWeekOfMonth } from '../utils/helpers.js';

export const toggleTheme = () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = isLight ? 'ph ph-moon text-3xl md:text-2xl mb-1 md:mb-0' : 'ph ph-sun text-3xl md:text-2xl mb-1 md:mb-0';
    }
    
    window.app.updateDashboard();
    window.app.renderSettings();
};

export const navigate = (view, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    if(view === 'settings') window.app.renderSettings();
    if(view === 'occurrences') window.app.renderOccurrences();
    if(view === 'overview') window.app.updateDashboard();
};

export const openModal = (id) => {
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
        
        window.app.populateMachineSelect('in-machine', document.getElementById('in-tipo-cat').value);
        
        const inService = document.getElementById('in-service');
        if(inService) {
            inService.innerHTML = state.serviceTypes.map(s => `<option value="${s}">${s}</option>`).join('');
        }
        window.app.updateWeekLabel();
    }
};

export const closeModal = (id) => { 
    document.getElementById(id).classList.add('hidden'); 
    if(id === 'modal-entry') document.getElementById('in-id').value = ""; 
    if(id === 'modal-os') document.getElementById('os-id').value = "";
};

export const populateMachineSelect = (selectId, category = null) => {
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
};

export const populateSelects = () => {
    window.app.populateMachineSelect('in-machine');
    window.app.populateMachineSelect('os-machine'); 
    window.app.populateMachineSelect('merge-keeper'); 
    window.app.populateMachineSelect('merge-loser'); 
    
    const inService = document.getElementById('in-service');
    if(inService) {
        inService.innerHTML = state.serviceTypes.map(s => `<option value="${s}">${s}</option>`).join('');
    }
};

export const updateWeekLabel = () => {
    const val = document.getElementById('in-date').value;
    if(val) { 
        const w = getWeekOfMonth(val); 
        document.getElementById('in-week-display').textContent = `S${w}`; 
    }
};

export const toggleDateInputs = () => {
    const mode = document.getElementById('view-granularity').value;
    if(mode === 'week') { 
        document.getElementById('container-date-range').classList.add('hidden'); 
        document.getElementById('container-date-single').classList.remove('hidden'); 
    } else { 
        document.getElementById('container-date-range').classList.remove('hidden'); 
        document.getElementById('container-date-single').classList.add('hidden'); 
    }
    window.app.updateDashboard();
};
