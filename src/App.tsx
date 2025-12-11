import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketTest } from './components/SocketTest';
import AdminDashboard from './components/AdminDashboard';
import Navigation from './components/Navigation';
import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navigation />
        <Routes>
          <Route path="/" element={<SocketTest />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
