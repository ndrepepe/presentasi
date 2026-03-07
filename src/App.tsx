import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import Presenter from './pages/Presenter';
import Remote from './pages/Remote';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/presenter/:sessionId" element={<Presenter />} />
          <Route path="/remote/:sessionId" element={<Remote />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;