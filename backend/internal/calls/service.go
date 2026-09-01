package calls

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"discord2/backend/internal/config"
	"discord2/backend/internal/db"
	"discord2/backend/internal/livekit"
	"discord2/backend/internal/ws"
	"go.uber.org/zap"
)

var (
	ErrNotConfigured = errors.New("livekit not configured")
	ErrCallNotFound  = errors.New("call not found")
)

// Call represents an in-progress (or recently ended) 1:1, group, or Go Live session.
type Call struct {
	ID              string
	ChannelID       string
	DMChannelID     string
	InitiatorID     string
	ParticipantIDs  []string
	Type            string
	LivekitRoomName string
	Status          string // "ringing" | "active" | "ended"
	IsLive          bool
	HistoryID       string
	CreatedAt       time.Time
}

// Service manages call and live-stream state in memory and coordinates
// LiveKit token issuance and real-time ringing signals over the WS hub.
type Service struct {
	mu      sync.RWMutex
	calls   map[string]*Call
	lk      config.LiveKitConfig
	hub     *ws.Hub
	db      *db.DB
	logger  *zap.Logger
}

func New(lk config.LiveKitConfig, hub *ws.Hub, database *db.DB, logger *zap.Logger) *Service {
	return &Service{
		calls:  make(map[string]*Call),
		lk:     lk,
		hub:    hub,
		db:     database,
		logger: logger,
	}
}

func contains(s []string, v string) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}

// sortedPair returns a stable, order-independent key for a 1:1 conversation so
// that "call user B" and "call user A" resolve to the same room.
func sortedPair(a, b string) string {
	if a < b {
		return a + "_" + b
	}
	return b + "_" + a
}

// Start creates a call (or live stream), issues a token for the initiator, and
// notifies the other participants via the WS hub (ringing) or channel (Go Live).
// It returns the created Call and the initiator's LiveKit token.
func (s *Service) Start(initiatorID, channelID, dmChannelID string, participants []string, callType string, isLive bool) (*Call, string, error) {
	if s.lk.APIKey == "" || s.lk.APISecret == "" || s.lk.WSURL == "" {
		return nil, "", ErrNotConfigured
	}

	// Derive a stable room name per conversation so that everyone joining the
	// same channel (or DM / 1:1 conversation) ends up in the SAME LiveKit room
	// instead of each click spawning a separate, disconnected call.
	scope := channelID
	if scope == "" {
		scope = dmChannelID
	}
	if scope == "" && len(participants) > 0 {
		// 1:1 call with no shared channel: stable key from the two participants.
		scope = "pair-" + sortedPair(initiatorID, participants[0])
	}
	base := "call-"
	if isLive {
		base = "live-"
	}
	room := base + scope

	s.mu.Lock()
	// Reuse an existing active call/live in the same room rather than spawning a
	// second, disconnected session when another user joins the same channel.
	for _, existing := range s.calls {
		if existing.LivekitRoomName == room && existing.Status != "ended" {
			if !contains(existing.ParticipantIDs, initiatorID) {
				existing.ParticipantIDs = append(existing.ParticipantIDs, initiatorID)
			}
			name := s.lookupUsername(context.Background(), initiatorID)
			token, err := livekit.CreateToken(s.lk, room, initiatorID, name, true, true)
			if err != nil {
				s.mu.Unlock()
				return nil, "", err
			}
			s.mu.Unlock()
			return existing, token, nil
		}
	}
	s.mu.Unlock()

	id := uuid.New().String()

	participantSet := map[string]bool{initiatorID: true}
	for _, p := range participants {
		if p != "" {
			participantSet[p] = true
		}
	}
	uniqueParticipants := make([]string, 0, len(participantSet))
	for p := range participantSet {
		uniqueParticipants = append(uniqueParticipants, p)
	}

	status := "ringing"
	if isLive {
		status = "active"
	}

	call := &Call{
		ID:              id,
		ChannelID:       channelID,
		DMChannelID:     dmChannelID,
		InitiatorID:     initiatorID,
		ParticipantIDs:  uniqueParticipants,
		Type:            callType,
		LivekitRoomName: room,
		Status:          status,
		IsLive:          isLive,
		CreatedAt:       time.Now(),
	}

	s.mu.Lock()
	s.calls[id] = call
	s.mu.Unlock()

	s.recordStart(call, channelID, initiatorID, uniqueParticipants)

	name := s.lookupUsername(context.Background(), initiatorID)
	token, err := livekit.CreateToken(s.lk, room, initiatorID, name, true, true)
	if err != nil {
		return nil, "", err
	}

	if isLive {
		if channelID != "" {
			if cid, err := uuid.Parse(channelID); err == nil {
				s.hub.SendToChannel(cid, &ws.Message{
					Op: ws.OpStreamStart,
					Data: map[string]interface{}{
						"call_id":      id,
						"room_name":    room,
						"channel_id":   channelID,
						"initiator_id": initiatorID,
						"ended":        false,
					},
				}, nil)
			}
		}
	} else {
		for _, p := range uniqueParticipants {
			if p == initiatorID {
				continue
			}
			if pid, err := uuid.Parse(p); err == nil {
				s.hub.SendToUser(pid, &ws.Message{
					Op: ws.OpCallIncoming,
					Data: map[string]interface{}{
						"call_id":          id,
						"type":             callType,
						"initiator_id":     initiatorID,
						"channel_id":       channelID,
						"dm_channel_id":    dmChannelID,
						"is_live":          false,
						"room_name":        room,
						"participants":     uniqueParticipants,
					},
				})
			}
		}
	}

	return call, token, nil
}

// Accept records that a participant accepted the call and returns a LiveKit token
// so they can join the room. It notifies the other participants.
func (s *Service) Accept(callID, userID string) (*Call, string, error) {
	s.mu.RLock()
	call, ok := s.calls[callID]
	s.mu.RUnlock()
	if !ok {
		return nil, "", ErrCallNotFound
	}

	name := s.lookupUsername(context.Background(), userID)
	token, err := livekit.CreateToken(s.lk, call.LivekitRoomName, userID, name, true, true)
	if err != nil {
		return nil, "", err
	}

	s.notify(call, "accept", userID)

	s.mu.Lock()
	if call.Status == "ringing" {
		call.Status = "active"
	}
	s.mu.Unlock()

	return call, token, nil
}

// Decline records that a participant declined the call and notifies the initiator.
func (s *Service) Decline(callID, userID string) error {
	s.mu.RLock()
	call, ok := s.calls[callID]
	s.mu.RUnlock()
	if !ok {
		return ErrCallNotFound
	}
	s.notify(call, "decline", userID)
	s.mu.Lock()
	call.Status = "ended"
	s.mu.Unlock()
	s.recordEnded(call)
	return nil
}

// End terminates a call or live stream and notifies all participants (and, for
// live streams, the channel).
func (s *Service) End(callID, userID string) error {
	s.mu.RLock()
	call, ok := s.calls[callID]
	s.mu.RUnlock()
	if !ok {
		return ErrCallNotFound
	}

	s.notify(call, "end", userID)

	if call.IsLive && call.ChannelID != "" {
		if cid, err := uuid.Parse(call.ChannelID); err == nil {
			s.hub.SendToChannel(cid, &ws.Message{
				Op: ws.OpStreamStart,
				Data: map[string]interface{}{
					"call_id":    callID,
					"channel_id": call.ChannelID,
					"ended":      true,
				},
			}, nil)
		}
	}

	s.mu.Lock()
	call.Status = "ended"
	s.mu.Unlock()
	s.recordEnded(call)
	return nil
}

// TokenFor issues a LiveKit token for an existing call/live stream (used by
// late-joiners and by viewers of a Go Live stream).
func (s *Service) TokenFor(callID, userID string, canPublish bool) (string, error) {
	s.mu.RLock()
	call, ok := s.calls[callID]
	s.mu.RUnlock()
	if !ok {
		return "", ErrCallNotFound
	}
	name := s.lookupUsername(context.Background(), userID)
	return livekit.CreateToken(s.lk, call.LivekitRoomName, userID, name, canPublish, true)
}

// ListActive returns calls the given user is part of that have not ended.
func (s *Service) ListActive(userID string) []*Call {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Call, 0)
	for _, c := range s.calls {
		if c.Status == "ended" {
			continue
		}
		if c.InitiatorID == userID || contains(c.ParticipantIDs, userID) {
			out = append(out, c)
		}
	}
	return out
}

func (s *Service) notify(call *Call, action, actorID string) {
	for _, p := range call.ParticipantIDs {
		if p == actorID {
			continue
		}
		if pid, err := uuid.Parse(p); err == nil {
			s.hub.SendToUser(pid, &ws.Message{
				Op: ws.OpCallAction,
				Data: map[string]interface{}{
					"call_id": call.ID,
					"action":  action,
					"user_id": actorID,
				},
			})
		}
	}
}

func callTypeInt(callType string, isLive bool) int {
	if isLive {
		return 4
	}
	if callType == "video" {
		return 2
	}
	return 1
}

func nullableUUID(id string) interface{} {
	if id == "" {
		return nil
	}
	return id
}

func (s *Service) recordStart(call *Call, channelID, initiatorID string, participants []string) {
	if s.db == nil {
		return
	}
	ctx := context.Background()
	arr := "{}"
	if len(participants) > 0 {
		arr = "{" + strings.Join(participants, ",") + "}"
	}
	var histID string
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO call_history (channel_id, dm_channel_id, initiator_id, type, livekit_room_name, participants)
		VALUES ($1, $2, $3, $4, $5, $6::uuid[])
		RETURNING id`,
		nullableUUID(channelID),
		nullableUUID(call.DMChannelID),
		initiatorID,
		callTypeInt(call.Type, call.IsLive),
		call.LivekitRoomName,
		arr,
	).Scan(&histID)
	if err != nil {
		s.logger.Error("failed to record call history", zap.Error(err))
		return
	}
	s.mu.Lock()
	call.HistoryID = histID
	s.mu.Unlock()
}

func (s *Service) recordEnded(call *Call) {
	if s.db == nil || call.HistoryID == "" {
		return
	}
	ctx := context.Background()
	if _, err := s.db.Pool.Exec(ctx, `UPDATE call_history SET ended_at = NOW() WHERE id = $1`, call.HistoryID); err != nil {
		s.logger.Error("failed to update call history", zap.Error(err))
	}
}

// lookupUsername returns the display_name (falling back to username) for the
// given user ID. If the lookup fails it returns the raw ID so the UI always
// has something to display.
func (s *Service) lookupUsername(ctx context.Context, userID string) string {
	if s.db == nil {
		return userID
	}
	var displayName, username sql.NullString
	err := s.db.Pool.QueryRow(ctx,
		`SELECT display_name, username FROM users WHERE id = $1`, userID,
	).Scan(&displayName, &username)
	if err != nil {
		return userID
	}
	if displayName.Valid && displayName.String != "" {
		return displayName.String
	}
	if username.Valid {
		return username.String
	}
	return userID
}

// ChannelMembers returns the user IDs of all members of the server that owns the
// given channel.
func (s *Service) ChannelMembers(channelID string) []string {
	if s.db == nil {
		return nil
	}
	ctx := context.Background()
	var serverID string
	if err := s.db.Pool.QueryRow(ctx, `SELECT server_id FROM channels WHERE id = $1`, channelID).Scan(&serverID); err != nil {
		return nil
	}
	rows, err := s.db.Pool.Query(ctx, `SELECT user_id FROM server_members WHERE server_id = $1`, serverID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var members []string
	for rows.Next() {
		var uid string
		if err := rows.Scan(&uid); err == nil {
			members = append(members, uid)
		}
	}
	return members
}
