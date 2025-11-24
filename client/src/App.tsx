import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Login } from "./Login/Login.tsx";
import { Register } from "./Register/Register.tsx";
import { Home } from "./Home/Home.tsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />}/>
        <Route path="/home" element={<Home />}/>
      </Routes>
    </Router>
  );
}

export default App;
