import './styles/global.css';
import { state } from './state/store.js';
import { auth, dbPath, onSnapshot, signInAnonymously, onAuthStateChanged } from './config/firebase.js';

// Import All Modules
import { toggleTheme, navigate, openModal, closeModal, populateMachineSelect, populateSelects, updateWeekLabel, toggleDateInputs } from './ui/navigation.js';
import { addSettingItem, editSettingItem, removeSettingItem, executePrompt, executeConfirm, executeMerge, openMergeModal, renderSettings, updateServiceColor } from './views/settings.js';
import { openModalOS, addOsItemRow, calcOsTotal, saveOS, editOS, renderOccurrences } from './views/occurrences.js';
import { updateDashboard, renderCharts, drawChart, handleChartClick, openDrillModal, showDrill, closeDrillDown, expandChart } from './views/overview.js';
import { saveEntry, deleteEntry, editEntry } from './services/data.js';
import { openAIChat, sendChatMessage, confirmAIInsert, confirmAIBatchInsert, confirmAISetting, openAIAnalysis, openAIDeepDive } from './services/aiChat.js';

// Reconstruct window.app to maintain backward compatibility with HTML onclicks
window.app = {
    aiTimeout: null,
    
    // UI & Navigation
    toggleTheme, navigate, openModal, closeModal, populateMachineSelect, populateSelects, updateWeekLabel, toggleDateInputs,
    
    // Settings & State manipulation
    addSettingItem, editSettingItem, removeSettingItem, executePrompt, executeConfirm, executeMerge, openMergeModal, renderSettings, updateServiceColor,
    
    // Occurrences & OS
    openModalOS, addOsItemRow, calcOsTotal, saveOS, editOS, renderOccurrences,
    
    // Overview & Dashboard
    updateDashboard, renderCharts, drawChart, handleChartClick, openDrillModal, showDrill, closeDrillDown, expandChart,
    
    // CRUD Data
    saveEntry, deleteEntry, editEntry,
    
    // AI functions
    openAIChat, sendChatMessage, confirmAIInsert, confirmAIBatchInsert, confirmAISetting, openAIAnalysis, openAIDeepDive
};

// Application Initialization
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
                
                window.app.updateDashboard();
                if(!document.getElementById('view-occurrences').classList.contains('hidden')) {
                    window.app.renderOccurrences();
                }
            }
        });
    } else { 
        signInAnonymously(auth); 
    }
});

// Initialize Date Defaults
setTimeout(() => {
    const today = new Date().toISOString().substring(0, 7);
    const dateStart = document.getElementById('date-start');
    const dateEnd = document.getElementById('date-end');
    const dateSingle = document.getElementById('date-single');
    
    if(dateStart) dateStart.value = today;
    if(dateEnd) dateEnd.value = today;
    if(dateSingle) dateSingle.value = today;
}, 100);
