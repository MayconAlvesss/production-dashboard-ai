export async function callGemini(prompt, isJson = false) {
    const key = import.meta.env.VITE_GEMINI_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${key}`;
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
