import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, MessageSquare, RotateCcw, Send } from 'lucide-react';
import { ChatbotRoleId, ChatMessage } from '../types/exportHub.ts';
import { MicTranscribeButton } from './MicTranscribeButton.tsx';

const CHAT_ROLES: {
  id: ChatbotRoleId;
  label: string;
  description: string;
  modelHint: string;
}[] = [
  {
    id: 'export-advisor',
    label: 'Export Advisor',
    description: 'General Sialkot OEM & buyer guidance',
    modelHint: 'gemini-4-hydrogen',
  },
  {
    id: 'fast-spec',
    label: 'Quick Spec Assistant',
    description: 'Fast GSM, MOQ & HS code lookups',
    modelHint: 'gemini-3.1-flash-lite',
  },
  {
    id: 'compliance-strategist',
    label: 'Trade Strategist',
    description: 'Deep compliance, duties & freight routing',
    modelHint: 'gemini-4-hydrogen (High Reasoning)',
  },
];

const STARTER_PROMPTS = [
  'What is the MOQ and lead time for custom 14oz WKF karate suits to Germany?',
  'Compare hand-stitched vs thermo-bonded footballs for UK club wholesale.',
  'How should Sarwar Khawaja Industries Pvt Ltd quote CIF Rotterdam for leather jackets?',
];

export const ExportChatbotPanel: React.FC = () => {
  const [roleId, setRoleId] = useState<ChatbotRoleId>('export-advisor');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'model',
      text: 'Assalam-o-Alaikum and welcome to the Sarwar Khawaja Industries Pvt Ltd Export Desk. Select a specialist role above and ask about Sialkot manufacturing specs, custom OEM orders, international buyer outreach, or freight logistics—by typing or using your microphone.',
      modelUsed: 'gemini-4-hydrogen',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) setInput('');
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          roleId,
          // Skip welcome greeting if it wasn't an actual turn from user
          history: messages.filter((m) => m.id !== 'welcome_1').map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chat request failed.');
      }
      const replyMsg: ChatMessage = {
        id: `m_${Date.now()}`,
        role: 'model',
        text: data.reply || 'No response received.',
        modelUsed: data.modelUsed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, replyMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send chat message.');
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    setError(null);
    setMessages([
      {
        id: 'welcome_1',
        role: 'model',
        text: 'Started a fresh export consultation thread. Ask anything about Sarwar Khawaja Industries Pvt Ltd products, pricing tiers, or global trade compliance.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const currentRole = CHAT_ROLES.find((r) => r.id === roleId) || CHAT_ROLES[0];

  return (
    <div className="flex flex-col h-full min-h-[540px] space-y-3">
      {/* Header + Role Switcher */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">AI Export Desk Assistant</h2>
          <p className="text-xs text-slate-400">
            Multi-turn Gemini trade consultation with role-specific system instructions and voice dictation.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 bg-white/5 hover:bg-white/10 rounded-md transition-colors shrink-0"
          title="Reset conversation history"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Role Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {CHAT_ROLES.map((r) => {
          const active = r.id === roleId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRoleId(r.id)}
              className={`p-2.5 rounded-lg border text-left transition-colors ${
                active
                  ? 'bg-amber-500/15 border-amber-400 text-white'
                  : 'bg-[#101829] border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <div className="text-xs font-semibold text-amber-300">{r.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{r.description}</div>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
        <span>Active Role: {currentRole.label}</span>
        <span className="font-mono text-slate-400">{currentRole.modelHint}</span>
      </div>

      {/* Scrollable Conversation Thread */}
      <div className="flex-1 min-h-[280px] max-h-[420px] overflow-y-auto border border-white/10 bg-[#090d16] rounded-xl p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-amber-500 text-slate-950 font-medium'
                  : 'bg-[#121b2e] border border-white/10 text-slate-200'
              }`}
            >
              {m.text}
            </div>
            <div className="mt-1 px-1 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <span>{m.role === 'user' ? 'You' : m.modelUsed || 'Advisor'} · {m.timestamp}</span>
              {m.role === 'model' && m.id !== 'welcome_1' && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(m.text);
                    setCopiedId(m.id);
                    window.setTimeout(() => setCopiedId(null), 1600);
                  }}
                  className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 font-sans"
                >
                  {copiedId === m.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-amber-300 px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Drafting response...</span>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Starter Prompts */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5">
          {STARTER_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void sendMessage(q)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-left rounded-md bg-[#101829] border border-white/10 text-slate-300 hover:text-white hover:border-amber-400/40 transition-colors"
            >
              <MessageSquare className="w-3 h-3 text-amber-300 shrink-0" />
              <span>{q}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-950/30 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Composer with Voice Transcription */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
        className="border border-white/10 bg-[#101829] rounded-xl p-3 space-y-2.5"
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Ask about karate suit GSM, FIFA football specs, buyer outreach, or speak via mic..."
          className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400 resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <MicTranscribeButton
            compact
            label="Speak (Transcribe)"
            contextHint="Sialkot sports and apparel export question"
            onTranscript={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded-md hover:bg-amber-400 disabled:opacity-60 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </form>
    </div>
  );
};
