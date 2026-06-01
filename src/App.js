import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
export default function App() {
    return (_jsxs("div", { style: { width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }, children: [_jsx(Toolbar, {}), _jsx(Canvas, {})] }));
}
