package livekit

import (
	"errors"

	lkauth "github.com/livekit/protocol/auth"

	"discord2/backend/internal/config"
)

// ErrNotConfigured is returned when LiveKit credentials are not set.
var ErrNotConfigured = errors.New("livekit not configured")

// CreateToken issues a LiveKit access token for a participant to join a room.
// canPublish controls whether the participant may publish tracks; canSubscribe
// controls whether they may receive other participants' tracks.
func CreateToken(cfg config.LiveKitConfig, room, identity, name string, canPublish, canSubscribe bool) (string, error) {
	if cfg.APIKey == "" || cfg.APISecret == "" || cfg.WSURL == "" {
		return "", ErrNotConfigured
	}

	at := lkauth.NewAccessToken(cfg.APIKey, cfg.APISecret)
	at.SetIdentity(identity)
	at.SetName(name)

	allow := canPublish
	sub := canSubscribe
	grant := &lkauth.VideoGrant{
		RoomJoin:            true,
		Room:                room,
		CanPublish:          &allow,
		CanSubscribe:        &sub,
		CanPublishData:      &allow,
		CanUpdateOwnMetadata: &allow,
	}
	at.AddGrant(grant)

	return at.ToJWT()
}
