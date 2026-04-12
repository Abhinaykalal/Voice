import '../style.css';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Only load script on client side
    if (typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.src = '/script.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
