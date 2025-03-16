import api from "./api";

// Types
export interface ChatMessage {
  message_id: string;
  session_id: string;
  sender_id: string;
  sender_name: string;
  message_type: "public" | "whisper" | "team";
  content: string;
  timestamp: string;
  is_censored: boolean;
  reactions?: Record<string, number>;
  recipient_id?: string;
  recipient_name?: string;
}

// Chat service functions
const chatService = {
  // Get chat messages for a game session
  getMessages: async (sessionId: string, limit?: number) => {
    const url = limit
      ? `/api/chat/${sessionId}?limit=${limit}`
      : `/api/chat/${sessionId}`;
    const response = await api.get(url);
    return response.data.messages as ChatMessage[];
  },

  // Get chat history for a completed game
  getChatHistory: async (sessionId: string) => {
    const response = await api.get(`/api/chat/${sessionId}/history`);
    return response.data.messages as ChatMessage[];
  },

  // Send a message
  sendMessage: async (sessionId: string, message: Partial<ChatMessage>) => {
    const response = await api.post(`/api/chat/${sessionId}`, message);
    return response.data;
  },

  // Add reaction to a message
  addReaction: async (
    sessionId: string,
    messageId: string,
    reactionType: string
  ) => {
    const response = await api.post(
      `/api/chat/${sessionId}/messages/${messageId}/reaction`,
      {
        reaction_type: reactionType,
      }
    );
    return response.data;
  },
};

export default chatService;
