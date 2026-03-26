# Heavy Machinery Production & Revenue Dashboard 🚜📊

![Dashboard Preview](https://via.placeholder.com/1200x600.png?text=Production+Dashboard+Preview)

A highly scalable, real-time production and revenue dashboard built to replace legacy Excel spreadsheets. This system manages heavy machinery operations (drilling rigs, concrete pumps, pile drivers), tracks downtime/maintenance costs, and leverages AI for business intelligence.

## 🚀 Business Value & Problem Solved
Initially, the engineering department relied on complex and slow Excel spreadsheets to track 5+ heavy machines across different clients. This project was developed to provide:
- **Real-time Revenue Tracking:** Automated parsing of daily production.
- **Downtime Management:** Tracking maintenance costs (O.S.) and equipment idle days.
- **AI-Powered Insights:** Integrated with Google Gemini to act as a Virtual CFO, analyzing revenue drops, peak days, and reading raw prompt injections to batch-insert data automatically.

## 🧠 Architecture Refactoring
This project underwent a massive architectural refactor to meet modern Senior-level engineering standards:
- **Before:** A 1,500+ lines monolithic "Spaghetti" Javascript file and inline CSS.
- **After:** A fully modularised ES6 architecture built with **Vite**. The logic is cleanly separated into `src/views`, `src/services`, `src/state`, and `src/utils`. 

## 🛠️ Tech Stack
- **Frontend:** Vanilla JavaScript (ES6 Modules), HTML5
- **Styling:** Tailwind CSS v4 (configured via Vite)
- **Bundler:** Vite
- **Database / Backend:** Firebase Firestore & Firebase Authentication (Anonymous)
- **AI Integration:** Google Gemini 2.5 API (Prompt Engineering & JSON structured responses)
- **Charts:** Chart.js

## 📦 Running Locally
1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file based on `.env.example` with your Firebase and Gemini credentials.
4. Start the development server:
```bash
npm run dev
```

## 🤖 AI-Augmented Workflow
This system wasn't just built to display data; it uses an **Agentic AI Workflow**. The user can type natural language commands like *"Added $5000 to Machine A today"* and the Gemini API processes the natural language into a strict JSON payload `{"intent": "insert", "revenue": 5000}` which is then automatically saved to Firebase.

---
<div align="center">
  <b>Developed with a focus on clean architecture, AI integration, and solving real-world workflow bottlenecks.</b>
  <br><br>
  <i>💡 Architecture & Engineering by <b>Maycon Alves</b></i>
  <br>
  <a href="https://github.com/MayconAlvesss" target="_blank">GitHub</a> | <a href="https://www.linkedin.com/in/maycon-alves-a5b9402bb/" target="_blank">LinkedIn</a>
</div>
