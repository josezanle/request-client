import { Routes, Route, Navigate } from 'react-router-dom'
import Relay from './pages/home'



// function PrivateRoute({ children }) {
//   const token = localStorage.getItem('token')
//   return token ? children : <Navigate to="/login" replace />
// }

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Relay />} />
    </Routes>
  )
}
