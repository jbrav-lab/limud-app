import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import './design-tokens.css';
import './styles.css';
import App from './App';
import { Gallery } from './screens/Gallery';

const showGallery = import.meta.env.DEV && location.search.includes('gallery');

createRoot(document.getElementById('root')!).render(<StrictMode>{showGallery ? <Gallery /> : <App />}</StrictMode>);
