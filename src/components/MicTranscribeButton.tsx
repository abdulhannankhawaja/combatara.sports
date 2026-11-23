import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';

interface MicTranscribeButtonProps {
  onTranscript: (text: string) => void;
  contextHint?: string;
  compact?: boolean;
  label?: string;
}

export const MicTranscribeButton: React.FC<MicTranscribeButtonProps> = ({
  onTranscript,
  contextHint = '',
  compact = false,
  label = 'Voice Input',
}) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 200) {
          setError('No audio captured. Hold or speak clearly before stopping.');
          return;
        }

        setTranscribing(true);
        try {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Failed to encode audio clip.'));
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType,
              contextHint,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Transcription failed.');
          }
          if (data.transcript) {
            onTranscript(data.transcript);
          } else {
            setError('No speech detected in recording.');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to transcribe audio.');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s >= 59) {
            stopRecording();
            return 60;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('Microphone access was denied. Enable mic permission to dictate.');
    }
  };

  const formattedTime = `0:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={transcribing}
        onClick={() => (recording ? stopRecording() : void startRecording())}
        title={recording ? 'Stop recording and transcribe' : 'Speak into microphone to transcribe'}
        className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-xs'
        } ${
          recording
            ? 'bg-red-500/20 text-red-200 border border-red-400/40 hover:bg-red-500/30'
            : 'bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10'
        } disabled:opacity-60`}
      >
        {transcribing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Transcribing...</span>
          </>
        ) : recording ? (
          <>
            <Square className="w-3 h-3 fill-current" />
            <span className="font-mono tabular-nums">Stop ({formattedTime})</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-amber-300" />
            <span>{label}</span>
          </>
        )}
      </button>
      {error && <span className="text-[11px] text-red-300 text-right max-w-[220px]">{error}</span>}
    </div>
  );
};
