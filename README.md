# Rắn săn mồi — Snake.io (HTML5)

Game rắn săn mồi kiểu **Snake.io / Slither.io** với **multiplayer realtime** qua WebSocket: nhiều tab/client cùng thấy nhau di chuyển, ăn food chung và va chạm.

## Luồng màn hình

1. **Trang chủ** — hình rắn + nút mũi tên « Chơi ngay »
2. **Chuẩn bị** — nhập tên, bấm « Vào trận »
3. **Chơi** — canvas game
4. **Hết ván** — hiển thị điểm; « Chơi lại » về màn chuẩn bị, « Thoát trò chơi » về trang chủ

## Chạy game multiplayer local

```bash
cd /Users/hoang/Downloads/web/ransanmoi
npm install
npm run dev
```

Mở trình duyệt tại **http://localhost:8080**.

### Test realtime 2 người chơi

1. Mở 2 tab (hoặc 2 trình duyệt) cùng URL `http://localhost:8080`
2. Mỗi tab nhập tên riêng, chọn màu riêng, bấm `Vào trận`
3. Di chuyển ở tab A và B để kiểm tra đồng bộ vị trí realtime
4. Ăn food và quan sát điểm + leaderboard cập nhật giữa các tab

## Điều khiển

| Thao tác | Hành động |
|----------|-----------|
| Di chuột / chạm | Lái hướng rắn |
| Giữ chuột trái / giữ chạm | Tăng tốc (tiêu hao độ dài nhẹ) |
| Va thân rắn khác | Thua |
| Chạm biên đỏ bản đồ | Thua |

## Đổi màu rắn

- Ở màn **Chuẩn bị**, chọn màu trong mục **Màu rắn của bạn** trước khi bấm `Vào trận`.
- Game sẽ ghi nhớ màu đã chọn bằng `localStorage` cho lần mở tiếp theo.

## Cấu trúc thư mục

```
ransanmoi/
├── index.html
├── css/style.css
├── js/
│   ├── config.js    # Cấu hình thế giới, tốc độ, bot
│   ├── entities.js  # Rắn, hạt mồi, va chạm
│   └── game.js      # Vòng lặp game, camera, HUD
└── README.md
```

## Kỹ thuật

- Canvas toàn màn hình, camera theo người chơi
- Thân rắn bám đuôi đầu qua lịch sử vị trí (trail)
- Server Node.js + WebSocket (`ws`) authoritative world state
- Multiplayer realtime: join theo tên/màu, food chung, collision player-player, score theo player
- Bảng xếp hạng top 8, hiển thị số người đang chơi
- ~420 hạt + quả cầu vàng lớn
- Không dùng CDN — chỉ HTML, CSS, JavaScript thuần

## Ghi chú

Kỷ lục điểm được lưu trong `localStorage` của trình duyệt.
