import { useState } from 'react';
import { api } from '../../api/client';
import { AsyncForm, Field, value } from '../../components/forms';

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ question: string; answer: string }[]>([]);
  const [question, setQuestion] = useState('');
  return <aside className="chat">
    {open && <section className="panel chat-panel" aria-label="Help chat">
      <h2>Help chat</h2>
      <div className="messages" aria-live="polite">
        {!messages.length && <p>Ask about your account or notifications.</p>}
        {messages.map((message, index) => <div key={index}>
          <p className="chat-question">{message.question}</p><p>{message.answer}</p>
        </div>)}
      </div>
      <AsyncForm submit="Send" action={async form => {
        const message = value(form, 'message');
        const result = await api<{ answer: string }>('/chatbot/message', 'POST', { message }, true);
        setMessages(previous => [...previous.slice(-9), { question: message, answer: result.answer }]);
        setQuestion('');
      }}><Field label="Your question" name="message" maxLength={500} value={question}
        onChange={event => setQuestion(event.target.value)} /></AsyncForm>
    </section>}
    <button onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close help' : 'Help chat'}</button>
  </aside>;
}

