# Tính năng dự án

## Tổng quan

Đây là một game HTML5 Canvas phong cách tu tiên, nơi người chơi điều khiển tâm trận và 72 thanh linh kiếm để chiến đấu với quái vật, tích lũy tu vi và đột phá cảnh giới.

## Các tính năng chính

### 1. Trận kiếm 72 thanh

- Có tổng cộng 72 thanh kiếm hoạt động cùng lúc.
- Kiếm được chia thành 3 tầng, mỗi tầng 24 thanh.
- Mỗi tầng có bán kính, nhịp quay và cảm giác chuyển động riêng để tạo hiệu ứng trận pháp dày và đẹp mắt.

### 2. Hai trạng thái hộ thể

- `Form 1`: đội hình ổn định, bám trận chặt hơn.
- `Form 2`: linh hoạt hơn, kiếm chuyển động sống hơn.
- Mỗi lần đổi form sẽ tiêu hao mana.

### 3. Cơ chế tấn công chủ động

- Khi giữ nút tấn công, các thanh kiếm tự tìm mục tiêu gần nhất để truy kích.
- Mỗi kiếm có độ trễ riêng nên đòn đánh không bay đồng loạt, nhìn tự nhiên hơn.
- Kiếm có thể bị khựng, văng ra hoặc vỡ nếu va chạm bất lợi.

### 4. Hệ thống mana

- Mana giảm khi di chuyển, tấn công, đổi form và hồi sinh kiếm.
- Mana tự hồi theo thời gian.
- Khi cạn mana, giao diện sẽ cảnh báo và một số hành động bị ngắt.

### 5. Tu vi và đột phá cảnh giới

- Diệt quái sẽ nhận `Tu vi`.
- Khi thanh tu vi đầy, người chơi có thể `Đột phá`.
- Đột phá có tỉ lệ thành công, có thể thất bại và bị trừ bớt tu vi.
- Cảnh giới mới sẽ tăng sát thương, độ bền kiếm, giới hạn mana và các chỉ số liên quan.

### 6. Linh đan và cơ duyên

- Quái có thể rơi linh đan sau khi bị tiêu diệt.
- Linh đan có nhiều phẩm chất khác nhau.
- Linh đan giúp tăng tỉ lệ đột phá.
- Sau một khoảng trễ ngắn, linh đan sẽ tự hút về tâm trận để người chơi thu thập.

### 7. Quái vật theo cấp độ

- Quái được sinh ngẫu nhiên theo cảnh giới.
- Hệ thống có cơ chế cân bằng để người chơi luôn gặp một phần quái vừa sức.
- Có quái `Tinh Anh` mạnh hơn, trâu hơn và thưởng tốt hơn.
- Một số quái có `Khiên`, buộc người chơi phải phá lớp bảo vệ trước.

### 8. Ultimate: Vạn Kiếm Quy Tông

- Khi hạ quái, người chơi tích lũy nộ cho tuyệt kỹ.
- Nút ultimate luôn hiện ở góc phải dưới và tự sáng dần từ dưới lên để biểu diễn tiến độ nộ.
- Khi nộ đầy, nút ultimate sẽ sáng lên để báo có thể kích hoạt ngay.
- Khi kích hoạt, các kiếm nhỏ sẽ từ từ hợp lại thành 1 đại kiếm; khi kết thúc, đại kiếm lại tách dần về đội hình ban đầu.
- Kích hoạt ultimate sẽ hợp nhất trận kiếm thành 1 đại kiếm duy nhất, đánh mạnh hơn trong một khoảng thời gian ngắn để giảm rối hình và nhẹ hiệu năng hơn.

### 9. Tùy chỉnh cấu hình trực tiếp trong game

- Có popup `Settings` để đổi nhanh thông số.
- Có thể chỉnh các nhóm lớn như:
  - nền sao và zoom,
  - số lượng kiếm, kích thước kiếm, tốc độ quay,
  - số lượng quái, tỉ lệ tinh anh, tỉ lệ có khiên,
  - mana, chi phí hành động, tỉ lệ rơi đan, thông số đột phá,
  - nộ tối đa, nộ nhận mỗi kill, thời lượng ultimate, thời gian hợp/tách kiếm và số nấc hiển thị trên nút nộ.
- Cấu hình được lưu bằng `localStorage`, nên tải lại trang vẫn giữ nguyên.

### 10. Hỗ trợ chuột, cảm ứng và zoom

- Desktop: di chuyển bằng chuột, giữ nút tấn công, zoom bằng con lăn hoặc phím.
- Mobile: hỗ trợ chạm và pinch-to-zoom.
- Zoom hoạt động mượt thay vì thay đổi đột ngột.

### 11. Hiệu ứng hình ảnh

- Nền sao nhấp nháy liên tục.
- Kiếm có vệt sáng, hào quang và hiệu ứng vỡ mảnh.
- Quái có glow theo cảnh giới, thanh máu, tên cấp độ và hiệu ứng khiên nứt.
- Có thông báo ngắn ở giữa màn hình cho các sự kiện quan trọng.

### 12. Linh thạch
- Quy đổi:
  - 1 Trung phẩm linh thạch = 100 Hạ phẩm linh thạch
  - 1 Thượng phẩm linh thạch = 100 Trung phẩm linh thạch = 10,000 Hạ phẩm linh thạch
  - 1 Cực phẩm linh thạch ≈ 100 Thượng phẩm linh thạch = 1,000,000 Hạ phẩm linh thạch

### 13. Đan dược
- Đan tăng tu vi
  - Hạ phẩm đan dược
  - Trung phẩm đan dược
  - Thượng phẩm đan dược
  - Cực phẩm đan dược
- Đan đột phá
  - Hạ phẩm {tên cảnh giới tiếp theo} đan
    - VD: Hạ phẩm trúc cơ đan
  - Trung phẩm {tên cảnh giới tiếp theo} đan
    - VD: Trung phẩm trúc cơ đan
  - Thượng phẩm {tên cảnh giới tiếp theo} đan
    - VD: Thượng phẩm trúc cơ đan
  - Cực phẩm {tên cảnh giới tiếp theo} đan
    - VD: Cực phẩm trúc cơ đan

### 14. Cửa hàng
- Mua bán đan dược thông qua linh thạch

## Trải nghiệm chơi nhanh

1. Di chuyển tâm trận đến gần quái.
2. Giữ nút tấn công để kiếm lao ra truy sát.
3. Thu thập linh đan và tích lũy tu vi.
4. Đột phá khi đủ điều kiện.
5. Kích hoạt ultimate khi nộ đầy để dọn quái nhanh hơn.
6. Mở phần cài đặt nếu muốn chỉnh nhịp độ hoặc độ khó.

## Ghi chú kỹ thuật

- Mã nguồn phát triển nằm trong `assets/`.
- Bản chạy web nằm trong `public/`.
- CSS và JS được build/minify bằng `gulp`.
