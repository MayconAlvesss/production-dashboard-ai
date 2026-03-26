export const state = {
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

// State Update Helpers (if needed)
export const updateState = (key, value) => {
    state[key] = value;
};
