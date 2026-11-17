import { StrictMode } from 'react';
import { useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import './design-tokens.css';
import './styles.css';
import App from './App';
import { askPersistentStorage, useNewerData } from './engine/store';
import { NewerData } from './screens/NewerData';
import { MoveBanner, MoveNotice } from './screens/Move';
import { receiveFromOldAddress } from './engine/move';
import { Gallery } from './screens/Gallery';

const showGallery = import.meta.env.DEV && location.search.includes('gallery');

let rerender = () => {};

/** The app, unless the stored data is newer than this copy of the app; plus the address-move notices. */
function Root() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  rerender = bump;
  if (useNewerData()) return <NewerData />;
  return (
    <>
      <MoveBanner />
      <MoveNotice />
      <App />
    </>
  );
}

askPersistentStorage();
receiveFromOldAddress(() => rerender());
createRoot(document.getElementById('root')!).render(<StrictMode>{showGallery ? <Gallery /> : <Root />}</StrictMode>);
