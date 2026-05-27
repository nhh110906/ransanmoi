const CONFIG = {
  NETWORK: {
    TICK_RATE: 20,
    WS_PATH: "/ws",
    /** Full WebSocket URL when backend is hosted separately (e.g. wss://your-app.onrender.com/ws). Empty = auto. */
    WS_URL: "",
    CONNECT_TIMEOUT_MS: 8000,
  },

  WORLD_W: 5000,
  WORLD_H: 5000,

  PELLET_COUNT: 420,
  PELLET_VALUE: 1,
  ORB_COUNT: 18,
  ORB_VALUE: 8,

  BASE_SPEED: 140,
  BOOST_SPEED: 260,
  BOOST_LENGTH_DRAIN: 22,
  TURN_SPEED: 4.2,

  SEGMENT_SPACING: 7,
  HEAD_RADIUS: 14,
  BODY_RADIUS: 10,
  START_LENGTH: 120,
  MIN_LENGTH: 40,

  BOT_COUNT: 16,
  LEADERBOARD_TOP: 8,
  BOT_RESPAWN_MIN: 2.5,
  BOT_RESPAWN_MAX: 5,
  SPAWN_MIN_DIST: 180,

  BOT_PERSONALITIES: ["foodie", "wanderer", "hunter", "nervous"],

  BOT_NAMES: [
    "Rắn Pro",
    "Săn Mồi 99",
    "Tốc Độ",
    "Vua Rắn",
    "Cua Bự",
    "Người Sói",
    "Bão Đen",
    "Chú Tư",
    "Mèo Rồng",
    "Đại Ca",
    "Linh Rắn",
    "Hoàng Kim",
    "Bóng Ma",
    "Thần Rắn",
    "Gà Con",
    "Hổ Nhỏ",
    "Bạch Tuộc",
    "Cơm Nị",
    "Rồng Xanh",
    "Sát Thủ",
  ],

  PLAYER_PALETTES: [
    { id: "mint", name: "Xanh ngọc", head: "#58f0a0", body: "#3bc87a", glow: "rgba(88,240,160,0.5)", stroke: "#e8fff2" },
    { id: "sky", name: "Xanh trời", head: "#6eb5ff", body: "#4090d4", glow: "rgba(110,181,255,0.45)", stroke: "#d8eeff" },
    { id: "violet", name: "Tím", head: "#c77dff", body: "#9b5fd4", glow: "rgba(199,125,255,0.45)", stroke: "#f0d8ff" },
    { id: "sun", name: "Vàng", head: "#ffe066", body: "#d4b030", glow: "rgba(255,224,102,0.45)", stroke: "#fff8d0" },
    { id: "rose", name: "Hồng", head: "#ff7eb9", body: "#e05590", glow: "rgba(255,126,185,0.45)", stroke: "#ffd8ec" },
    { id: "fire", name: "Cam đỏ", head: "#ff8866", body: "#d45a40", glow: "rgba(255,136,102,0.45)", stroke: "#ffe0d8" },
  ],

  COLORS: {
    player: { head: "#58f0a0", body: "#3bc87a", glow: "rgba(88,240,160,0.5)", stroke: "#e8fff2" },
    bots: [
      { head: "#6eb5ff", body: "#4a8fd4", glow: "rgba(110,181,255,0.4)", stroke: "#d0e8ff" },
      { head: "#c77dff", body: "#9b5fd4", glow: "rgba(199,125,255,0.4)", stroke: "#f0d8ff" },
      { head: "#ffb347", body: "#e08a30", glow: "rgba(255,179,71,0.4)", stroke: "#ffe8c8" },
      { head: "#ff7eb9", body: "#e05590", glow: "rgba(255,126,185,0.4)", stroke: "#ffd8ec" },
      { head: "#ffe066", body: "#d4b030", glow: "rgba(255,224,102,0.4)", stroke: "#fff8d0" },
      { head: "#66e8d8", body: "#38b8a8", glow: "rgba(102,232,216,0.4)", stroke: "#d0fff8" },
      { head: "#ff8866", body: "#d45a40", glow: "rgba(255,136,102,0.4)", stroke: "#ffe0d8" },
      { head: "#a8ff66", body: "#78c840", glow: "rgba(168,255,102,0.4)", stroke: "#e8ffd8" },
      { head: "#8899ff", body: "#5a6ed4", glow: "rgba(136,153,255,0.4)", stroke: "#dce0ff" },
      { head: "#ff66aa", body: "#d44080", glow: "rgba(255,102,170,0.4)", stroke: "#ffd0e8" },
      { head: "#66bbff", body: "#4090d4", glow: "rgba(102,187,255,0.4)", stroke: "#d8eeff" },
      { head: "#ddaa66", body: "#b08040", glow: "rgba(221,170,102,0.4)", stroke: "#fff0d8" },
      { head: "#bb88ff", body: "#9060d4", glow: "rgba(187,136,255,0.4)", stroke: "#ecdcff" },
      { head: "#88ffbb", body: "#50c888", glow: "rgba(136,255,187,0.4)", stroke: "#dcffe8" },
      { head: "#ffaa88", body: "#d47850", glow: "rgba(255,170,136,0.4)", stroke: "#ffe8dc" },
      { head: "#88ddff", body: "#50a8d4", glow: "rgba(136,221,255,0.4)", stroke: "#dcf4ff" },
    ],
  },

  GRID_SIZE: 50,
  WALL_MARGIN: 30,
};
