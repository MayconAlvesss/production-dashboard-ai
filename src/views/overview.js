import { state } from '../state/store.js';
import { getCssVar, getWeekOfMonth, getMachineType } from '../utils/helpers.js';

export const updateDashboard = () => {
    const searchEl = document.getElementById('global-search');
    const typeFilterEl = document.getElementById('filter-type');
    const granularityEl = document.getElementById('view-granularity');
    const weekFilterEl = document.getElementById('filter-week-num');
    
    if(!typeFilterEl || !granularityEl) return;

    const search = searchEl ? searchEl.value.toLowerCase() : "";
    const typeFilter = typeFilterEl.value;
    const granularity = granularityEl.value;
    const weekFilter = weekFilterEl ? weekFilterEl.value : "all";
    
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
    
    window.app.renderCharts(filtered, sDate, eDate, search, typeFilter);
    
    if(window.app.aiTimeout) clearTimeout(window.app.aiTimeout);
    window.app.aiTimeout = setTimeout(() => { window.app.openAIAnalysis(filtered); }, 1000);
};

export const renderCharts = (data, sDate, eDate, search, typeFilter) => {
    const machineAgg = data.reduce((acc, i) => { 
        if(!acc[i.maquina]) acc[i.maquina] = { val: 0, tipo: i.tipo }; 
        acc[i.maquina].val += i.faturamento; 
        return acc; 
    }, {});
    const mLabels = Object.keys(machineAgg).sort((a,b) => machineAgg[b].val - machineAgg[a].val);
    window.app.drawChart('chart-production', 'bar', mLabels, mLabels.map(l => machineAgg[l].val), mLabels.map(l => state.colorMap[machineAgg[l].tipo] || state.defaultPalette[0]));
    
    const sAgg = data.reduce((acc, i) => { acc[i.servico] = (acc[i.servico]||0)+i.faturamento; return acc; }, {});
    const sLabels = Object.keys(sAgg);
    const sColors = sLabels.map((s, idx) => state.serviceColors[s] || state.defaultPalette[idx % state.defaultPalette.length]);
    window.app.drawChart('chart-service', 'doughnut', sLabels, Object.values(sAgg), sColors);
    
    const clientAgg = data.reduce((acc, i) => { acc[i.cliente] = (acc[i.cliente]||0)+i.faturamento; return acc; }, {});
    const cLabels = Object.keys(clientAgg).sort((a,b) => clientAgg[b] - clientAgg[a]).slice(0, 10);
    window.app.drawChart('chart-clients', 'bar', cLabels, cLabels.map(l => clientAgg[l]), '#10b981', true);
    
    const granularityEl = document.getElementById('view-granularity');
    const weekFilterEl = document.getElementById('filter-week-num');
    const granularity = granularityEl ? granularityEl.value : 'month';
    const weekFilter = weekFilterEl ? weekFilterEl.value : 'all';

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
    window.app.drawChart('chart-trend', 'line', sortedKeys, sortedKeys.map(l => trend[l]), getCssVar('--brand-main') || '#dc2626');
    
    const servRent = data.reduce((acc, i) => { 
        if(!acc[i.servico]) acc[i.servico] = { sum: 0, count: 0 }; 
        acc[i.servico].sum += i.faturamento; 
        acc[i.servico].count++; 
        return acc; 
    }, {});
    const rLabels = Object.keys(servRent);
    const rColors = rLabels.map(s => state.serviceColors[s] || state.defaultPalette[0]); 
    window.app.drawChart('chart-profitability', 'bar', rLabels, rLabels.map(l => servRent[l].sum / servRent[l].count), rColors);
    
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
    window.app.drawChart('chart-idle', 'bar', iLabels, iLabels.map(l => idleAgg[l]), '#ef4444');
};

export const drawChart = (id, type, labels, values, colors, horizontal = false) => {
    // Requires Chart on window
    if(!window.Chart) return;

    const canvas = document.getElementById(id); 
    if(!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if(state.charts[id]) state.charts[id].destroy();
    
    const textColor = getCssVar('--color-txmuted') || getCssVar('--text-muted') || '#9ca3af';
    const gridColor = getCssVar('--color-border') || getCssVar('--border-color') || '#1f2937';
    
    window.Chart.defaults.color = textColor; 
    window.Chart.defaults.borderColor = gridColor;
    
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
                window.app.handleChartClick(id, label);
            }
        }
    };

    if (type === 'line') { 
        const brandRgb = getCssVar('--shadow-glow').split(' ').pop() || 'rgba(220, 38, 38, 0.4)'; 
        const brandColor = getCssVar('--color-brand-main') || getCssVar('--brand-main') || '#dc2626';

        const gradient = ctx.createLinearGradient(0, 0, 0, 300); 
        gradient.addColorStop(0, brandRgb); 
        gradient.addColorStop(1, 'rgba(220, 38, 38, 0)'); 
        datasetConfig.backgroundColor = gradient; 
        datasetConfig.borderColor = brandColor; 
        datasetConfig.pointRadius = 5; 
        datasetConfig.pointBackgroundColor = getCssVar('--color-surface') || getCssVar('--bg-surface') || '#ffffff'; 
        datasetConfig.pointBorderColor = brandColor; 
        datasetConfig.pointBorderWidth = 2; 
        datasetConfig.pointHoverRadius = 7;
    }
    
    if (type === 'doughnut') {
        datasetConfig.borderWidth = 2; 
        datasetConfig.borderColor = getCssVar('--color-surface') || getCssVar('--bg-surface') || '#161e31'; 
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

    state.charts[id] = new window.Chart(canvas, { type: type, data: { labels, datasets: [datasetConfig] }, options: options });
};

export const handleChartClick = (chartId, label) => {
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

    window.app.openDrillModal(title, filterFn);
};

export const openDrillModal = (title, filterFn) => {
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
    
    window.app.openModal('modal-drill-list');
};

export const expandChart = (type) => { 
    window.app.openModal('modal-expand'); 
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
    
    window.app.drawChart('chart-expanded', 'bar', labels, labels.map(l => agg[l].val), labels.map(l => type === 'production' ? (state.colorMap[agg[l].tipo] || state.defaultPalette[0]) : (state.serviceColors[l] || state.defaultPalette[labels.indexOf(l) % state.defaultPalette.length]))); 
};

export const showDrill = (val, key) => { 
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
};

export const closeDrillDown = () => document.getElementById('drill-down-container').classList.add('hidden');
