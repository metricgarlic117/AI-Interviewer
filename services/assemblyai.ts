/**
 * AssemblyAI Real-Time Transcription Service
 * Handles WebSocket connection to AssemblyAI for streaming voice transcription
 */

export interface AssemblyAITranscriptResult {
    text: string;
    isFinal: boolean;
    confidence?: number;
}

export interface AssemblyAISessionConfig {
    onTranscript: (result: AssemblyAITranscriptResult) => void;
    onError: (error: Error) => void;
    onClose: () => void;
    sampleRate?: number;
}

export class AssemblyAISession {
    private socket: WebSocket | null = null;
    private config: AssemblyAISessionConfig;
    private isConnected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private audioQueue: ArrayBuffer[] = [];

    constructor(config: AssemblyAISessionConfig) {
        this.config = {
            ...config,
            sampleRate: config.sampleRate || 16000,
        };
    }

    async connect(): Promise<void> {
        try {
            // Get temporary token from our API route
            const response = await fetch('/api/assemblyai-token', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to get AssemblyAI token');
            }

            const { apiKey } = await response.json();

            // Connect to AssemblyAI Real-Time WebSocket using current API
            // Include API key as query parameter for authentication
            const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${this.config.sampleRate}&token=${apiKey}`;

            // Create WebSocket with Authorization header
            this.socket = new WebSocket(wsUrl);

            // Note: Browser WebSocket API doesn't support custom headers directly
            // So we'll send the API key in the first message after connection

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
                    console.log(`[AssemblyAI] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                    setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
                }
            };
        } catch (error: any) {
            console.error('[AssemblyAI] Connection failed:', error);
            this.config.onError(error);
            throw error;
        }
    }

    sendAudio(audioData: Int16Array | Float32Array): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('[AssemblyAI] Socket not ready, queuing audio');
            // Convert to Int16Array if needed
            const int16Data = audioData instanceof Float32Array
                ? this.float32ToInt16(audioData)
                : audioData;
            this.audioQueue.push(int16Data.buffer as ArrayBuffer);
            return;
        }

        try {
            // AssemblyAI expects PCM16 audio data
            const int16Data = audioData instanceof Float32Array
                ? this.float32ToInt16(audioData)
                : audioData;

            // Convert to base64 for JSON transmission
            const base64Audio = this.arrayBufferToBase64(int16Data.buffer as ArrayBuffer);

            this.socket.send(JSON.stringify({
                audio_data: base64Audio
            }));
        } catch (error) {
            console.error('[AssemblyAI] Failed to send audio:', error);
        }
    }

    disconnect(): void {
        if (this.socket) {
            // Send termination message
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ terminate_session: true }));
            }
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
        this.audioQueue = [];
    }

    isActive(): boolean {
        return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
    }

    // Helper: Convert Float32Array to Int16Array
    private float32ToInt16(float32Array: Float32Array): Int16Array {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return int16Array;
    }

    // Helper: Convert ArrayBuffer to base64
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}

// Factory function for easy usage
export async function createAssemblyAISession(
    config: AssemblyAISessionConfig
): Promise<AssemblyAISession> {
    const session = new AssemblyAISession(config);
    await session.connect();
    return session;
}
