import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./Context/ThemeContext.jsx";
import { AppProvider } from './Context/AppContext.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
  <BrowserRouter>
      <ThemeProvider>
        <AppProvider>
            <App />
        </AppProvider>
      </ThemeProvider>
  </BrowserRouter>
  </React.StrictMode>
)
