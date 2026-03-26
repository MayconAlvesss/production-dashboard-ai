import { state } from '../state/store.js';
import { dbPath, setDoc, auth, signInAnonymously } from '../config/firebase.js';

export const saveEntry = async () => {
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
        if(feedback) {
            feedback.style.opacity = '1'; 
            setTimeout(() => { feedback.style.opacity = '0'; }, 2000);
        }
        
        if(existingId) window.app.closeModal('modal-entry'); 
        window.app.updateDashboard();
        
        const modalList = document.getElementById('modal-drill-list');
        if(modalList && !modalList.classList.contains('hidden')) window.app.closeModal('modal-drill-list'); 
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar dados. Verifique sua conexão. " + error.message);
    }
};

export const deleteEntry = (id, contextType = 'entry') => { 
    state.tempConfirm = { type: contextType, id: id };
    document.getElementById('modal-confirm').classList.remove('hidden');
};

export const editEntry = (id) => {
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
    
    window.app.populateSelects(); 
    
    document.getElementById('in-machine').value = found.maquina; 
    document.getElementById('in-service').value = found.servico; 
    document.getElementById('in-status').value = found.status; 
    document.getElementById('in-dias-parados').value = found.diasParados || 0; 
    
    window.app.updateWeekLabel(); 
    window.app.closeModal('modal-drill-list');
    window.app.openModal('modal-entry');
};
