import { useEffect, useState } from 'react';
import Home from './pages/Home';
import Editor from './pages/Editor';

const path = () => (location.hash.replace(/^#/, '') || '/');

export default function App() {
  const [route, setRoute] = useState(path());
  useEffect(() => {
    const h = () => { setRoute(path()); window.scrollTo(0, 0); };
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);
  const nav = (p: string) => { location.hash = p; };
  return route.startsWith('/editor') ? <Editor nav={nav} /> : <Home nav={nav} />;
}
