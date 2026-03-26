export const getWeekOfMonth = (dateStr) => {
    if(!dateStr) return 1;
    const d = new Date(dateStr);
    const date = d.getUTCDate();
    return Math.ceil(date / 7);
};

export const formatCurrency = (val) => {
    return val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0});
};
