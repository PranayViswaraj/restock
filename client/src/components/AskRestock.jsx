import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Mic, MessageCircle } from 'lucide-react';
import { post } from '../lib/api.js';

const SUGGESTIONS = ['Why did you buy cups?', 'What did you block this week?', 'How much did I save cross-border?', 'What is waiting for me?'];
const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/** Chat about decisions, answered from purchases, audit, mandate and cash data. Optional voice input. */
export default function AskRestock() {
  const [messages, setMessages] = useState([{ from: 'agent', text: "Hi Pranay! Ask me why I bought something, what Guardian blocked, or how much you've saved." }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const listRef = useRef(null);
  const recRef = useRef(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const ask = async (q) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput('');
    setMessages((m) => [...m, { from: 'user', text: question }]);
    setBusy(true);
    try {
      const r = await post('/api/agent/ask', { question });
      setMessages((m) => [...m, { from: 'agent', text: r.answer, source: r.source }]);
    } catch (err) {
      setMessages((m) => [...m, { from: 'agent', text: `Sorry, ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    if (!SpeechRecognition) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e) => ask(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <section className="card flex flex-col" aria-labelledby="ask-title">
      <h2 id="ask-title" className="card-title flex items-center gap-2"><MessageCircle size={16} className="text-accent" aria-hidden="true" /> Ask Restock</h2>
      <p className="card-sub">Every decision is explained and logged.</p>
      <div ref={listRef} className="mt-3 flex max-h-72 min-h-40 flex-1 flex-col gap-2 overflow-y-auto" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13px] ${m.from === 'user' ? 'self-end rounded-br-md bg-accent text-accent-ink' : 'self-start rounded-bl-md bg-surface-2 text-ink'}`}>
              {m.text}
            </motion.div>
          ))}
          {busy && <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="thinking-shimmer self-start px-2 text-[13px] font-medium">Restock is thinking…</motion.div>}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)} disabled={busy} className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] text-ink-2 hover:border-solid hover:text-ink">{s}</button>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Why was the syrup blocked?" aria-label="Ask Restock" maxLength={500} />
        {SpeechRecognition && (
          <button type="button" className={`btn h-[38px] w-[38px] shrink-0 px-0 ${listening ? 'border-bad text-bad' : ''}`} onClick={listen} aria-label={listening ? 'Stop listening' : 'Ask by voice'} aria-pressed={listening}>
            <Mic size={16} />
          </button>
        )}
        <button className="btn btn-primary h-[38px] w-[38px] shrink-0 px-0" disabled={busy || !input.trim()} aria-label="Send"><Send size={15} /></button>
      </form>
    </section>
  );
}
