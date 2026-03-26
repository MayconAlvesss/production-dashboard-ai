import { state } from '../state/store.js';

export const getCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const getWeekOfMonth = (dateStr) => {
    if(!dateStr) return 1;
    const d = new Date(dateStr);
    const date = d.getUTCDate();
    return Math.ceil(date / 7);
};

export const getMachineType = (mName) => {
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
