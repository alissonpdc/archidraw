import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';

export default function App() {
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toolbar />
      <Canvas />
    </div>
  );
}
