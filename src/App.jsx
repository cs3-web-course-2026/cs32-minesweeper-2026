import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DudnikKira from './pages/DudnikKira';

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/dudnik-kira" element={<DudnikKira />} />
            </Routes>
        </Router>
    );
}