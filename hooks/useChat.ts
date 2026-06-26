import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export function useChat() {
  const { session } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!session || !text.trim() || isLoading || limitReached) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
    };
    const assistantId = `assistant-${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    // Historial sin el mensaje que acabamos de agregar
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text.trim(), history }),
        signal: abortRef.current.signal,
      });

      if (response.status === 429) {
        setLimitReached(true);
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        return;
      }

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming no disponible');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.delta) {
              accumulated += parsed.delta;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, content: accumulated } : m,
                ),
              );
            }
          } catch {
            // línea malformada
          }
        }
      }

      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
      );
      setDailyCount(c => c + 1);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Ocurrió un error. Intenta de nuevo.', isStreaming: false }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [session, messages, isLoading, limitReached]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setLimitReached(false);
  }, []);

  return { messages, isLoading, dailyCount, limitReached, sendMessage, stopStreaming, clearMessages };
}
