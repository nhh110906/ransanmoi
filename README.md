# Rắn săn mồi — Snake.io (HTML5)

Game rắn săn mồi kiểu **Snake.io / Slither.io**: điều khiển bằng chuột hoặc cảm ứng, ăn hạt để lớn, tranh điểm với bot AI trên bản đồ lớn.

## Luồng màn hình

1. **Trang chủ** — hình rắn + nút mũi tên « Chơi ngay »
2. **Chuẩn bị** — nhập tên, bấm « Vào trận »
3. **Chơi** — canvas game
4. **Hết ván** — hiển thị điểm; « Chơi lại » về màn chuẩn bị, « Thoát trò chơi » về trang chủ

## Chạy game

### Cách 1 — Mở trực tiếp

Double-click file `index.html` hoặc kéo vào trình duyệt (Chrome, Firefox, Edge, Safari).

### Cách 2 — Máy chủ cục bộ (khuyến nghị)

```bash
cd /Users/hoang/Downloads/web/ransanmoi
python3 -m http.server 8080
```

Mở trình duyệt: **http://localhost:8080**

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
- **16 bot AI** (người chơi ảo) với tên/màu/hành vi khác nhau, hồi sinh sau khi chết
- Bảng xếp hạng top 8, hiển thị số người đang chơi
- ~420 hạt + quả cầu vàng lớn
- Không dùng CDN — chỉ HTML, CSS, JavaScript thuần

## Ghi chú

Kỷ lục điểm được lưu trong `localStorage` của trình duyệt.
