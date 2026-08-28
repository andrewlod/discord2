package config

import (
	"os"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	App        AppConfig        `mapstructure:"app"`
	Database   DatabaseConfig   `mapstructure:"database"`
	JWT        JWTConfig        `mapstructure:"jwt"`
	GoogleOAuth GoogleOAuthConfig `mapstructure:"google_oauth"`
	WebSocket  WebSocketConfig  `mapstructure:"websocket"`
	Upload     UploadConfig     `mapstructure:"upload"`
	LiveKit    LiveKitConfig    `mapstructure:"livekit"`
}

type AppConfig struct {
	Env         string `mapstructure:"env"`
	Port        int    `mapstructure:"port"`
	FrontendURL string `mapstructure:"frontend_url"`
}

type DatabaseConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	User            string        `mapstructure:"user"`
	Password        string        `mapstructure:"password"`
	Name            string        `mapstructure:"name"`
	SSLMode         string        `mapstructure:"sslmode"`
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	MaxConnLifetime time.Duration `mapstructure:"max_conn_lifetime"`
}

type JWTConfig struct {
	Secret      string        `mapstructure:"secret"`
	AccessTTL   time.Duration `mapstructure:"access_ttl"`
	RefreshTTL  time.Duration `mapstructure:"refresh_ttl"`
	Issuer      string        `mapstructure:"issuer"`
}

type GoogleOAuthConfig struct {
	ClientID     string `mapstructure:"client_id"`
	ClientSecret string `mapstructure:"client_secret"`
	RedirectURL  string `mapstructure:"redirect_url"`
}

type WebSocketConfig struct {
	ReadBufferSize  int           `mapstructure:"read_buffer_size"`
	WriteBufferSize int           `mapstructure:"write_buffer_size"`
	PingInterval    time.Duration `mapstructure:"ping_interval"`
	PongWait        time.Duration `mapstructure:"pong_wait"`
}

type UploadConfig struct {
	MaxSizeMB     int      `mapstructure:"max_size_mb"`
	Path          string   `mapstructure:"path"`
	AllowedTypes  []string `mapstructure:"allowed_types"`
}

type LiveKitConfig struct {
	APIKey    string `mapstructure:"api_key"`
	APISecret string `mapstructure:"api_secret"`
	WSURL     string `mapstructure:"ws_url"`
	APIURL    string `mapstructure:"api_url"`
}

func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/app")

	viper.AutomaticEnv()

	// Bind env vars (env vars take precedence over config file)
	bindEnvs()

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func bindEnvs() {
	viper.BindEnv("app.env", "APP_ENV")
	viper.BindEnv("app.port", "APP_PORT")
	viper.BindEnv("app.frontend_url", "FRONTEND_URL")

	viper.BindEnv("database.host", "DATABASE_HOST")
	viper.BindEnv("database.port", "DATABASE_PORT")
	viper.BindEnv("database.user", "DATABASE_USER")
	viper.BindEnv("database.password", "DATABASE_PASSWORD")
	viper.BindEnv("database.name", "DATABASE_NAME")
	viper.BindEnv("database.sslmode", "DATABASE_SSLMODE")
	viper.BindEnv("database.max_open_conns", "DATABASE_MAX_OPEN_CONNS")
	viper.BindEnv("database.max_idle_conns", "DATABASE_MAX_IDLE_CONNS")
	viper.BindEnv("database.max_conn_lifetime", "DATABASE_MAX_CONN_LIFETIME")

	viper.BindEnv("jwt.secret", "JWT_SECRET")
	viper.BindEnv("jwt.access_ttl", "JWT_ACCESS_TTL")
	viper.BindEnv("jwt.refresh_ttl", "JWT_REFRESH_TTL")

	viper.BindEnv("google_oauth.client_id", "GOOGLE_CLIENT_ID")
	viper.BindEnv("google_oauth.client_secret", "GOOGLE_CLIENT_SECRET")
	viper.BindEnv("google_oauth.redirect_url", "GOOGLE_REDIRECT_URL")

	viper.BindEnv("livekit.api_key", "LIVEKIT_API_KEY")
	viper.BindEnv("livekit.api_secret", "LIVEKIT_API_SECRET")
	viper.BindEnv("livekit.ws_url", "LIVEKIT_WS_URL")
	viper.BindEnv("livekit.api_url", "LIVEKIT_API_URL")
}

func GetDSN(cfg *DatabaseConfig) string {
	return "postgres://" + cfg.User + ":" + cfg.Password + "@" + cfg.Host + ":" +
		string(rune(cfg.Port)) + "/" + cfg.Name + "?sslmode=" + cfg.SSLMode
}

func init() {
	if os.Getenv("APP_ENV") == "" {
		os.Setenv("APP_ENV", "development")
	}
}