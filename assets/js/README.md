# JavaScript folder structure

Cấu trúc này được tách theo kiểu phổ biến trong các dự án front-end, giúp dễ mở rộng và dễ onboarding:

- `app/`: điểm vào ứng dụng (bootstrap).
- `config/`: cấu hình dùng toàn cục.
- `state/`: ngữ cảnh/trạng thái game chia sẻ.
- `core/`: phần lõi game engine, hằng số và utility.
- `entities/`: các thực thể/domain object chính (enemy, sword, camera...).
- `features/`: nhóm theo tính năng nghiệp vụ.
  - `input/`: xử lý input.
  - `progression/`: tiến trình/leveling.
  - `systems/`: hệ thống gameplay riêng.
  - `ui/`: toàn bộ logic UI.
- `vendors/`: thư viện bên thứ ba.

> Thứ tự file build vẫn được giữ trong `gulpfile.js` để không làm thay đổi hành vi runtime.
