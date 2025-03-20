import api from "./api";

export interface ChatMessage {
  message_id: string;
  game_id: string;
  sender_id: string;
  sender_name?: string;
  sender_team?: string;
  message_type: "public" | "team" | "dead" | "private";
  content: string;
  timestamp: string;
  recipients?: string[];
}

export interface SendMessageRequest {
  message_type: "public" | "team" | "dead" | "private";
  content: string;
  recipients?: string[];
}

const chatService = {
  // Get all messages for a game
  getMessages: async (gameId: string): Promise<ChatMessage[]> => {
    try {
      const response = await api.get(`/api/games/${gameId}/messages`);
      return response.data.messages || [];
    } catch (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
  },

  // Send a message in a game
  sendMessage: async (
    gameId: string,
    messageData: SendMessageRequest
  ): Promise<ChatMessage> => {
    const response = await api.post(
      `/api/games/${gameId}/messages`,
      messageData
    );
    return response.data.message;
  },

  // Get private messages between two users
  getPrivateMessages: async (
    gameId: string,
    otherUserId: string
  ): Promise<ChatMessage[]> => {
    try {
      const response = await api.get(
        `/api/games/${gameId}/messages/private/${otherUserId}`
      );
      return response.data.messages || [];
    } catch (error) {
      console.error("Error fetching private messages:", error);
      return [];
    }
  },

  // Get team chat messages
  getTeamMessages: async (gameId: string): Promise<ChatMessage[]> => {
    try {
      const response = await api.get(`/api/games/${gameId}/messages/team`);
      return response.data.messages || [];
    } catch (error) {
      console.error("Error fetching team messages:", error);
      return [];
    }
  },

  // Get spectator (dead players) chat messages
  getSpectatorMessages: async (gameId: string): Promise<ChatMessage[]> => {
    try {
      const response = await api.get(`/api/games/${gameId}/messages/spectator`);
      return response.data.messages || [];
    } catch (error) {
      console.error("Error fetching spectator messages:", error);
      return [];
    }
  },
};

export default chatService;
