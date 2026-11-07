import { render } from 'preact';
import { App } from './app';
import '@fontsource/tiny5/400.css';
import '@fontsource/press-start-2p/400.css';
import './styles.css';

const root = document.getElementById('app');
if (root) render(<App />, root);
