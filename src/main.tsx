import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import Login from './pages/Login.tsx'
import Dashboard from './pages/Dashboard.tsx'
import './index.css'

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/demandas" element={
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Demandas - Em desenvolvimento</h1>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800">← Voltar ao Dashboard</a>
        </div>
      } />
      <Route path="/municipes" element={
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Munícipes - Em desenvolvimento</h1>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800">← Voltar ao Dashboard</a>
        </div>
      } />
      <Route path="/areas" element={
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Áreas - Em desenvolvimento</h1>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800">← Voltar ao Dashboard</a>
        </div>
      } />
      <Route path="/tags" element={
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Tags - Em desenvolvimento</h1>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800">← Voltar ao Dashboard</a>
        </div>
      } />
      <Route path="/" element={<App />} />
      <Route path="*" element={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Página não encontrada</h1>
            <a href="/" className="text-blue-600 hover:text-blue-800">
              ← Voltar para início
            </a>
          </div>
        </div>
      } />
    </Routes>
  </BrowserRouter>
)

createRoot(document.getElementById("root")!).render(<AppRouter />);