package ws

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"discord2/backend/internal/db"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

type Hub struct {
	clients    map[uuid.UUID]*Client
	servers    map[uuid.UUID]map[uuid.UUID]*Client
	channels   map[uuid.UUID]map[uuid.UUID]*Client
	dms        map[uuid.UUID]map[uuid.UUID]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *Message
	logger     *zap.Logger
	DB         *db.DB
	mu         sync.RWMutex
}

type Client struct {
	hub           *Hub
	conn          *websocket.Conn
	send          chan *Message
	userID        uuid.UUID
	serverID      *uuid.UUID
	channelID     *uuid.UUID
	dmChannelID   *uuid.UUID
	voiceChannelID *uuid.UUID
	voiceServerID  *uuid.UUID
}

type Message struct {
	Op   int                    `json:"op"`
	Data map[string]interface{} `json:"d"`
}

const (
	OpIdentify       = 0
	OpHeartbeat      = 1
	OpMessageCreate  = 2
	OpTypingStart    = 3
	OpMessageAck     = 4
	OpVoiceStateUpdate = 10
	OpCallIncoming   = 11
	OpCallAction     = 12
	OpStreamStart    = 13
	OpChannelSelect  = 20
	OpDMSelect       = 21
	OpReady          = 0
	OpMessageEvent   = 1
	OpMessageDelete  = 2
	OpPresenceUpdate = 3
	OpTypingEvent    = 4
	OpError          = 5
	OpHeartbeatAck   = 6
)

func NewHub(logger *zap.Logger) *Hub {
	return &Hub{
		clients:    make(map[uuid.UUID]*Client),
		servers:    make(map[uuid.UUID]map[uuid.UUID]*Client),
		channels:   make(map[uuid.UUID]map[uuid.UUID]*Client),
		dms:        make(map[uuid.UUID]map[uuid.UUID]*Client),
		register:   make(chan *Client, 256),
		unregister: make(chan *Client, 256),
		broadcast:  make(chan *Message, 256),
		logger:     logger,
	}
}

func (h *Hub) Run(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			h.mu.Lock()
			for _, client := range h.clients {
				close(client.send)
			}
			h.mu.Unlock()
			return

		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.userID] = client
			h.logger.Debug("client registered", zap.String("user_id", client.userID.String()))
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.userID]; ok {
				delete(h.clients, client.userID)
				if client.serverID != nil {
					if serverClients, ok := h.servers[*client.serverID]; ok {
						delete(serverClients, client.userID)
					}
				}
				if client.channelID != nil {
					if channelClients, ok := h.channels[*client.channelID]; ok {
						delete(channelClients, client.userID)
					}
				}
				if client.dmChannelID != nil {
					if dmClients, ok := h.dms[*client.dmChannelID]; ok {
						delete(dmClients, client.userID)
					}
				}
				close(client.send)
				h.logger.Debug("client unregistered", zap.String("user_id", client.userID.String()))
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for _, client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client.userID)
				}
			}
			h.mu.RUnlock()

		case <-ticker.C:
			h.mu.RLock()
			for _, client := range h.clients {
				select {
				case client.send <- &Message{Op: OpHeartbeat, Data: map[string]interface{}{}}:
				default:
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (c *Client) handleVoiceStateUpdate(msg *Message) {
	if c.hub.DB == nil {
		return
	}

	channelIDStr, _ := msg.Data["channel_id"].(string)
	serverIDStr, _ := msg.Data["server_id"].(string)

	var newChannelID *uuid.UUID
	if channelIDStr != "" {
		if id, err := uuid.Parse(channelIDStr); err == nil {
			newChannelID = &id
		}
	}
	var newServerID *uuid.UUID
	if serverIDStr != "" {
		if id, err := uuid.Parse(serverIDStr); err == nil {
			newServerID = &id
		}
	}

	if newChannelID == nil && newServerID == nil {
		return
	}

	flags := func(key string) bool {
		if v, ok := msg.Data[key].(bool); ok {
			return v
		}
		return false
	}
	selfMute := flags("self_mute")
	selfDeaf := flags("self_deaf")
	selfVideo := flags("self_video")
	selfStream := flags("self_stream")

	ctx := context.Background()
	db := c.hub.DB

	// Notify the previous voice channel that this user has left it.
	if c.voiceChannelID != nil && (newChannelID == nil || *newChannelID != *c.voiceChannelID) {
		c.hub.SendToChannel(*c.voiceChannelID, &Message{
			Op: OpVoiceStateUpdate,
			Data: map[string]interface{}{
				"user_id":    c.userID.String(),
				"server_id":  serverIDOrNil(c.voiceServerID),
				"channel_id": nil,
			},
		}, nil)
		if c.voiceServerID != nil {
			_, _ = db.Pool.Exec(ctx, `DELETE FROM voice_states WHERE user_id = $1 AND server_id = $2`, c.userID, *c.voiceServerID)
		}
	}

	if newChannelID != nil && newServerID != nil {
		sessionID := uuid.New()
		_, err := db.Pool.Exec(ctx, `
			INSERT INTO voice_states (user_id, server_id, channel_id, session_id, self_mute, self_deaf, self_video, self_stream)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (user_id, server_id) DO UPDATE SET
				channel_id = EXCLUDED.channel_id,
				session_id = EXCLUDED.session_id,
				self_mute = EXCLUDED.self_mute,
				self_deaf = EXCLUDED.self_deaf,
				self_video = EXCLUDED.self_video,
				self_stream = EXCLUDED.self_stream,
				joined_at = NOW()
		`, c.userID, *newServerID, *newChannelID, sessionID, selfMute, selfDeaf, selfVideo, selfStream)
		if err != nil {
			c.hub.logger.Error("failed to upsert voice state", zap.Error(err))
			return
		}

		c.hub.SendToChannel(*newChannelID, &Message{
			Op: OpVoiceStateUpdate,
			Data: map[string]interface{}{
				"user_id":    c.userID.String(),
				"server_id":  newServerID.String(),
				"channel_id": newChannelID.String(),
				"session_id": sessionID.String(),
				"self_mute":  selfMute,
				"self_deaf":  selfDeaf,
				"self_video": selfVideo,
				"self_stream": selfStream,
			},
		}, nil)

		c.voiceChannelID = newChannelID
		c.voiceServerID = newServerID
		return
	}

	// Leaving voice entirely.
	c.voiceChannelID = nil
	c.voiceServerID = nil
}

func serverIDOrNil(id *uuid.UUID) string {
	if id == nil {
		return ""
	}
	return id.String()
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) Broadcast(message *Message) {
	h.broadcast <- message
}

func (h *Hub) SendToUser(userID uuid.UUID, message *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if client, ok := h.clients[userID]; ok {
		select {
		case client.send <- message:
		default:
		}
	}
}

func (h *Hub) SendToServer(serverID uuid.UUID, message *Message, excludeUserID *uuid.UUID) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if serverClients, ok := h.servers[serverID]; ok {
		for userID, client := range serverClients {
			if excludeUserID != nil && userID == *excludeUserID {
				continue
			}
			select {
			case client.send <- message:
			default:
			}
		}
	}
}

func (h *Hub) SendToChannel(channelID uuid.UUID, message *Message, excludeUserID *uuid.UUID) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if channelClients, ok := h.channels[channelID]; ok {
		for userID, client := range channelClients {
			if excludeUserID != nil && userID == *excludeUserID {
				continue
			}
			select {
			case client.send <- message:
			default:
			}
		}
	}
}

func (h *Hub) SendToDM(dmChannelID uuid.UUID, message *Message, excludeUserID *uuid.UUID) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if dmClients, ok := h.dms[dmChannelID]; ok {
		for userID, client := range dmClients {
			if excludeUserID != nil && userID == *excludeUserID {
				continue
			}
			select {
			case client.send <- message:
			default:
			}
		}
	}
}

func (h *Hub) SetUserServer(userID, serverID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client, ok := h.clients[userID]; ok {
		if client.serverID != nil {
			if serverClients, ok := h.servers[*client.serverID]; ok {
				delete(serverClients, userID)
			}
		}
		client.serverID = &serverID
		if h.servers[serverID] == nil {
			h.servers[serverID] = make(map[uuid.UUID]*Client)
		}
		h.servers[serverID][userID] = client
	}
}

func (h *Hub) SetUserChannel(userID, channelID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client, ok := h.clients[userID]; ok {
		if client.channelID != nil {
			if channelClients, ok := h.channels[*client.channelID]; ok {
				delete(channelClients, userID)
			}
		}
		client.channelID = &channelID
		if h.channels[channelID] == nil {
			h.channels[channelID] = make(map[uuid.UUID]*Client)
		}
		h.channels[channelID][userID] = client
	}
}

func (h *Hub) SetUserDMChannel(userID, dmChannelID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client, ok := h.clients[userID]; ok {
		if client.dmChannelID != nil {
			if dmClients, ok := h.dms[*client.dmChannelID]; ok {
				delete(dmClients, userID)
			}
		}
		client.dmChannelID = &dmChannelID
		if h.dms[dmChannelID] == nil {
			h.dms[dmChannelID] = make(map[uuid.UUID]*Client)
		}
		h.dms[dmChannelID][userID] = client
	}
}

func (h *Hub) GetOnlineUsers() []uuid.UUID {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users := make([]uuid.UUID, 0, len(h.clients))
	for userID := range h.clients {
		users = append(users, userID)
	}
	return users
}

func (h *Hub) IsUserOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

func (h *Hub) GetChannelMembers(channelID uuid.UUID) []uuid.UUID {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if channelClients, ok := h.channels[channelID]; ok {
		members := make([]uuid.UUID, 0, len(channelClients))
		for userID := range channelClients {
			members = append(members, userID)
		}
		return members
	}
	return nil
}

func NewClient(hub *Hub, conn *websocket.Conn, userID uuid.UUID) *Client {
	return &Client{
		hub:  hub,
		conn: conn,
		send: make(chan *Message, 256),
		userID: userID,
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.hub.logger.Error("websocket read error", zap.Error(err))
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			c.hub.logger.Error("failed to unmarshal message", zap.Error(err))
			continue
		}

		c.handleMessage(&msg)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteJSON(message); err != nil {
				c.hub.logger.Error("websocket write error", zap.Error(err))
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg *Message) {
	switch msg.Op {
	case OpIdentify:
		// Already handled during connection
	case OpHeartbeat:
		c.send <- &Message{Op: OpHeartbeatAck, Data: map[string]interface{}{}}
	case OpMessageCreate:
		// Handled by API layer
	case OpTypingStart:
		if channelIDStr, ok := msg.Data["channel_id"].(string); ok {
			if channelID, err := uuid.Parse(channelIDStr); err == nil {
				c.hub.SendToChannel(channelID, &Message{
					Op: OpTypingEvent,
					Data: map[string]interface{}{
						"channel_id": channelIDStr,
						"user_id":    c.userID.String(),
					},
				}, &c.userID)
			}
		}
	case OpVoiceStateUpdate:
		c.handleVoiceStateUpdate(msg)
	case OpChannelSelect:
		if channelIDStr, ok := msg.Data["channel_id"].(string); ok {
			if channelID, err := uuid.Parse(channelIDStr); err == nil {
				c.hub.SetUserChannel(c.userID, channelID)
			}
		}
		if serverIDStr, ok := msg.Data["server_id"].(string); ok {
			if serverID, err := uuid.Parse(serverIDStr); err == nil {
				c.hub.SetUserServer(c.userID, serverID)
			}
		}
	case OpDMSelect:
		if dmChannelIDStr, ok := msg.Data["dm_channel_id"].(string); ok {
			if dmChannelID, err := uuid.Parse(dmChannelIDStr); err == nil {
				c.hub.SetUserDMChannel(c.userID, dmChannelID)
			}
		}
	}
}