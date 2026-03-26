import { state } from '../state/store.js';
import { callGemini } from './geminiApi.js';
import { dbPath, setDoc } from '../config/firebase.js';

export const openAIChat = () => window.app.openModal('modal-ai-chat');

export const sendChatMessage = async () => {
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
        
        // marked requires window.marked now or we import it if it's installed via npm
        // assuming it's available globally as currently configured, or we should import it
        let aiHtml = `<div class="chat-bubble chat-ai ai-content">${window.marked.parse(aiResponse.message || "")}</div>`;

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
};

export const confirmAIInsert = async (data) => {
    const now = new Date();
    const mKey = state.months[now.getMonth()];
    const entry = { id: "IA_" + Date.now(), date: data.data || now.toISOString(), maquina: data.maquina || "Desconhecida", tipo: "Perfuratriz", cliente: data.cliente || "Avulso", servico: data.servico || "Geral", faturamento: parseFloat(data.valor) || 0, status: 'operando', diasParados: 0 };
    if(!state.data[mKey]) state.data[mKey] = [];
    state.data[mKey].push(entry);
    await setDoc(dbPath, { fullRawData: state.data }, { merge: true });
    window.app.updateDashboard();
    document.getElementById('chat-history').innerHTML += `<div class="chat-bubble chat-ai text-status-success">Salvo!</div>`;
};

export const confirmAIBatchInsert = async (items) => {
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
    window.app.updateDashboard();
    document.getElementById('chat-history').innerHTML += `<div class="chat-bubble chat-ai text-status-success">Importados: ${count}!</div>`;
};

export const confirmAISetting = async (target, value) => { 
    state[target].push(value); 
    await setDoc(dbPath, {[target]: state[target]}, {merge:true}); 
    window.app.renderSettings(); 
};

export const openAIAnalysis = async (data) => {
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
        elTextReview.innerHTML = window.marked.parse(aiResponse);
    } catch (e) { 
        elTextReview.innerHTML = "Inteligência Artificial temporariamente indisponível."; 
    }
};

export const openAIDeepDive = () => { 
    window.app.openModal('modal-ai-deep-dive'); 
    const allData = Object.values(state.data).flat(); 
    window.app.openAIAnalysis(allData); 
};
