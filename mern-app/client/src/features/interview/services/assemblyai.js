/**
 * AssemblyAI Real-Time Transcription Service
 * Handles WebSocket connection to AssemblyAI for streaming voice transcription
 */

import { api } from '../../../lib/axios';

export class AssemblyAISession {
  socket = null;
  isConnected = false;
  reconnectAttempts = 0;
  maxReconnectAttempts = 3;
  audioQueue = [];

  constructor(config) {
    this.config = {
      ...config,
      sampleRate: config.sampleRate || 16000,
    };
  }

  async connect() {
    try {
      // Get a short-lived, session-scoped token from our API.
      // The permanent AssemblyAI API key never reaches the browser.
      const res = await api.post('/ai/assemblyai-token');
      const { token } = res.data.data;

      const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${this.config.sampleRate}&token=${token}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[AssemblyAI] Connected and authenticated');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Send queued audio if any
        while (this.audioQueue.length > 0) {
          const audioData = this.audioQueue.shift();
          if (audioData && this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(audioData);
          }
        }
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.message_type === 'PartialTranscript') {
          this.config.onTranscript({
            text: data.text || '',
            isFinal: false,
            confidence: data.confidence,
          });
        } else if (data.message_type === 'FinalTranscript') {
          this.config.onTranscript({
            text: data.text || '',
            isFinal: true,
            confidence: data.confidence,
          });
        } else if (data.message_type === 'SessionBegins') {
          console.log('[AssemblyAI] Session started:', data.session_id);
        } else if (data.error) {
          console.error('[AssemblyAI] Error:', data.error);
          this.config.onError(new Error(data.error));
        }
      };

      this.socket.onerror = (error) => {
        console.error('[AssemblyAI] WebSocket error:', error);
        this.config.onError(new Error('WebSocket connection error'));
      };

      this.socket.onclose = () => {
        console.log('[AssemblyAI] Connection closed');
        this.isConnected = false;
        this.config.onClose();

        // Auto-reconnect logic
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(
            `[AssemblyAI] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
          );
          setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
        }
      };
    } catch (error) {
      console.error('[AssemblyAI] Connection failed:', error);
      this.config.onError(error);
      throw error;
    }
  }

  sendAudio(audioData) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[AssemblyAI] Socket not ready, queuing audio');
      const int16Data =
        audioData instanceof Float32Array ? this.float32ToInt16(audioData) : audioData;
      this.audioQueue.push(int16Data.buffer);
      return;
    }

    try {
      // AssemblyAI expects PCM16 audio data
      const int16Data =
        audioData instanceof Float32Array ? this.float32ToInt16(audioData) : audioData;

      // Convert to base64 for JSON transmission
      const base64Audio = this.arrayBufferToBase64(int16Data.buffer);

      this.socket.send(
        JSON.stringify({
          audio_data: base64Audio,
        })
      );
    } catch (error) {
      console.error('[AssemblyAI] Failed to send audio:', error);
    }
  }

  disconnect() {
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ terminate_session: true }));
      }
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.audioQueue = [];
  }

  isActive() {
    return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
  }

  // Helper: Convert Float32Array to Int16Array
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  // Helper: Convert ArrayBuffer to base64
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
