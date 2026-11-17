import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import './design-tokens.css';
import './styles.css';
import App from './App';
import { askPersistentStorage, useNewerData } from './engine/store';
import { NewerData } from './screens/NewerData';
import { Gallery } from './screens/Gallery';

const showGallery = import.meta.env.DEV && location.search.includes('gallery');

/** The app, unless the stored data is newer than this copy of the app. */
function Root() {
  return useNewerData() ? <NewerData /> : <App />;
}

askPersistentStorage();
createRoot(document.getElementById('root')!).render(<StrictMode>{showGallery ? <Gallery /> : <Root />}</StrictMode>);
