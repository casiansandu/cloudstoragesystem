import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { WorkerProvider } from "./context/WorkerProvider.tsx";
import { SrpRegister } from "./Register/SrpRegister.tsx";
import { Home } from "./Home/Home.tsx";
import { SrpLogin } from "./Login/SrpLogin.tsx";

function App() {
  return (
    <Router>
      <div className="app-shell">
        <WorkerProvider>
          <Routes>
            <Route path="/login" element={<SrpLogin />} />
            <Route path="/register" element={<SrpRegister />}/>
            <Route path="/home" element={<Home />}/>
            <Route path='*' element={<Navigate to="/home"/>} />
          </Routes>
        </WorkerProvider>
      </div>
    </Router>
  );
}

export default App;