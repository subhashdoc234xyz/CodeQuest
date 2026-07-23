import { useEffect, useRef, useState } from 'react';

const BRIDGE_HTTP = 'http://localhost:7420';
const BRIDGE_WS = 'ws://localhost:7420';

// status: 'detecting' | 'connected' | 'failed' | 'sandbox'
export function useLocalBridge() {
  const [status, setStatus] = useState('detecting');
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  
  const socketRef = useRef(null);
  const retryCountRef = useRef(0);
  const cancelledRef = useRef(false);

  async function autoConnect() {
    if (cancelledRef.current) return;
    setStatus('detecting');

    let code;
    try {
      const res = await fetch(`${BRIDGE_HTTP}/pairing-code`, { mode: 'cors' });
      if (!res.ok) throw new Error('Bridge responded with error status.');
      const data = await res.json();
      code = data.code;
    } catch (err) {
      if (!cancelledRef.current) {
        setStatus('sandbox');
        setError('Local Bridge not detected. Using in-browser sandbox mode.');
      }
      return;
    }

    if (cancelledRef.current) return;

    try {
      const ws = new WebSocket(BRIDGE_WS);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'pair', code }));
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          return;
        }

        if (data.type === 'paired') {
          if (data.success) {
            socketRef.current = ws;
            setSocket(ws);
            setStatus('connected');
            setError(null);
          } else {
            ws.close();
            if (retryCountRef.current < 1) {
              retryCountRef.current += 1;
              setStatus('detecting');
              setError('Stale pairing code. Retrying connection once...');
              autoConnect();
            } else {
              setStatus('failed');
              setError('Auto-pairing failed. Code is stale.');
            }
          }
        }
      };

      ws.onerror = () => {
        if (!cancelledRef.current) {
          setStatus('sandbox');
          setError('Could not connect to Local Bridge WebSocket.');
        }
      };

      ws.onclose = () => {
        if (!cancelledRef.current && status === 'connected') {
          setStatus('sandbox');
          setError('Local Bridge connection closed.');
          setSocket(null);
        }
      };
    } catch (e) {
      if (!cancelledRef.current) {
        setStatus('sandbox');
        setError('WebSocket initialization failed.');
      }
    }
  }

  // Connect manually with a code
  const connectWithCode = (manualCode) => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    setStatus('detecting');
    setError(null);
    setSocket(null);

    try {
      const ws = new WebSocket(BRIDGE_WS);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'pair', code: manualCode }));
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          return;
        }

        if (data.type === 'paired') {
          if (data.success) {
            socketRef.current = ws;
            setSocket(ws);
            setStatus('connected');
            setError(null);
          } else {
            ws.close();
            setStatus('failed');
            setError('Invalid pairing code.');
          }
        }
      };

      ws.onerror = () => {
        setStatus('failed');
        setError('Could not connect to Local Bridge.');
      };

      ws.onclose = () => {
        // do not trigger sandbox fallback unless they want to
      };
    } catch (e) {
      setStatus('failed');
      setError('Connection failed.');
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    autoConnect();

    return () => {
      cancelledRef.current = true;
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, error, socket, connectWithCode, retryAutoConnect: () => { retryCountRef.current = 0; autoConnect(); } };
}
