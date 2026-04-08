# 72 Thanh Trúc Phong Vân Kiếm - Đại Canh Kiếm Trận

Demo game tu tiên hành động 2D viết bằng `HTML5 Canvas`, nơi người chơi điều khiển tâm trận để vận hành kiếm trận, săn yêu thú, tích lũy tu vi, đột phá cảnh giới và mở khóa thêm nhiều hệ thống như kỳ trùng, đan dược, vật liệu, túi trữ vật và tuyệt kỹ `Vạn Kiếm Quy Tông`.

## ✦ Link dự án

- Demo trực tuyến: [https://vhn-dev.github.io/thanh-truc-phong-van-kiem/](https://vhn-dev.github.io/thanh-truc-phong-van-kiem/)
- Mã nguồn GitHub: [https://github.com/VHN-DEV/thanh-truc-phong-van-kiem](https://github.com/VHN-DEV/thanh-truc-phong-van-kiem)

## ✦ Tổng quan trải nghiệm

Vòng chơi chính của dự án xoay quanh việc di chuyển tâm trận trên bản đồ, áp sát quái để tấn công, thu nhặt chiến lợi phẩm, dùng tài nguyên để tăng sức mạnh và tiếp tục đột phá lên cảnh giới cao hơn. Đây không chỉ là một demo hiệu ứng kiếm trận, mà đã phát triển thành một game loop hoàn chỉnh với nhiều lớp tiến triển:

- Điều khiển kiếm trận hoặc chuyển sang `Khu Trùng Thuật`.
- Săn quái thường, quái tinh anh và mục tiêu có cảnh giới cao hơn.
- Nhặt đan dược, linh thạch, trùng noãn, nguyên liệu và yêu đan.
- Mở túi trữ vật để dùng, bán hoặc quản lý vật phẩm.
- Mua thêm vật phẩm trong `Linh Thị Cửa Hàng`.
- Tích lũy tu vi để đột phá các đại cảnh giới.
- Tích nộ để kích hoạt tuyệt kỹ `Vạn Kiếm Quy Tông`.

## ✦ Tính năng nổi bật

### 1. Thanh Trúc Kiếm Trận 72 kiếm

Hệ thống cốt lõi của game là kiếm trận hộ thể xoay quanh tâm trận:

- Nhiều thanh kiếm vận hành đồng thời, tạo cảm giác bầy kiếm bao quanh nhân vật.
- Kiếm có thể vừa giữ đội hình, vừa lao ra truy kích mục tiêu khi người chơi giữ tấn công.
- Khi kiếm bị phá hủy, chúng để lại hiệu ứng mảnh vỡ rồi hồi quy về tâm trận để tái tạo.
- Đội hình kiếm luôn tự cân lại sau khi va chạm hoặc sau khi kết thúc truy kích.

Mục tiêu của hệ thống này là tạo cảm giác chiến đấu “kiếm trận sống”, không phải chỉ là các viên đạn bay ra rồi biến mất.

### 2. Hai kiểu chiến đấu chính: kiếm trận và kỳ trùng

Người chơi không chỉ có một cách đánh:

- `Thanh Trúc Kiếm Trận`: lối chơi mặc định, thiên về kiếm khí hộ thể và truy sát mục tiêu.
- `Khu Trùng Thuật`: mở khóa sau khi lĩnh ngộ bí pháp, cho phép thay bầy kiếm bằng đàn kỳ trùng.

Khi đổi sang `Khu Trùng Thuật`, toàn bộ cảm giác combat thay đổi:

- Kỳ trùng sẽ bám vào mục tiêu thay vì lao chém như kiếm.
- Mỗi loài có vai trò riêng, ví dụ có loài phá giáp nhanh, có loài khống chế khiến địch khó né tránh, có loài thiên về ăn mòn hoặc gây sát thương ổn định.
- Trong bảng kỹ năng, người chơi có thể bật hoặc tắt từng loài tham chiến để giữ lại một phần đàn trùng cho mục đích sinh sản và phát triển sau này.

### 3. Ultimate `Vạn Kiếm Quy Tông`

Đây là tuyệt kỹ mạnh nhất của hệ kiếm trận:

- Nộ được tích lũy dần qua chiến đấu.
- Khi kích hoạt, các kiếm nhỏ hợp lại thành một đại kiếm chủ lực.
- Trong thời gian ultimate, đại kiếm gây cảm giác áp đảo và dọn quái rất nhanh.
- Khi kết thúc, đại kiếm tách ra, kiếm trận trở về trạng thái bình thường.

Hệ thống này vừa mang màu sắc tu tiên, vừa là đòn bùng nổ sức mạnh rõ ràng để người chơi xoay chuyển giao tranh.

### 4. Tu vi, cảnh giới và đột phá

Game có lớp tiến triển theo phong cách tu tiên:

- Mỗi quái vật bị tiêu diệt sẽ cho tu vi.
- Khi tích đủ tu vi của cảnh giới hiện tại, người chơi bước vào giai đoạn sẵn sàng đột phá.
- Tỉ lệ đột phá khác nhau theo từng đại cảnh giới.
- Có thể dùng đan hỗ trợ để tăng xác suất thành công.
- Nếu đột phá thất bại, người chơi bị tổn thất một phần tiến trình và bonus hỗ trợ.

Nhờ đó, game không chỉ tăng sức mạnh bằng trang bị hay chỉ số thẳng, mà còn có cảm giác “tu luyện” đúng chất tiên hiệp.

### 5. Hệ đan dược nhiều nhóm công dụng

Đan dược không còn chỉ là vật phẩm nhặt lên rồi cộng thẳng chỉ số, mà đã trở thành một hệ thống quản lý trong túi đồ:

- Đan tăng tu vi để đẩy nhanh quá trình tu luyện.
- Đan tăng tỉ lệ đột phá cho cảnh giới kế tiếp.
- Đan tăng công hoặc tăng chỉ số chiến đấu trong lượt chơi hiện tại.
- Đan cuồng bạo giúp bùng sát thương trong thời gian ngắn, đôi khi kèm tác dụng phụ.
- Đan hồi linh lực, tăng giới hạn linh lực, tăng tốc độ và các nhóm hỗ trợ khác.

Việc phải quyết định khi nào dùng, giữ lại hay bán đan giúp trải nghiệm có chiều sâu hơn phần “farm rồi nhặt”.

### 6. Kỳ trùng, trùng noãn và hệ ấp nở

Đây là lớp nội dung mở rộng lớn của dự án:

- Yêu thú có thể rơi `Trùng noãn` của nhiều loài khác nhau.
- Trứng cần đủ nguyên liệu mới có thể ấp nở.
- Một số loài còn cần đúng loại môi trường sống hoặc “túi/habitat” phù hợp để phát triển ổn định.
- Sau khi nở, kỳ trùng được ghi nhận vào `Kỳ Trùng Bảng`.
- Người chơi có thể vừa nuôi đàn trùng, vừa chọn loài nào ra chiến đấu và loài nào giữ lại để sinh thêm.

Hệ này khiến game có thêm nhánh phát triển giống thu thập, nuôi dưỡng và tối ưu đội hình.

### 7. Nguyên liệu rơi theo loài yêu thú

Mỗi nhóm yêu thú không còn rơi đồ một cách ngẫu nhiên hoàn toàn:

- Từng loại mục tiêu có bảng rơi nguyên liệu riêng.
- Các nguyên liệu phục vụ cho ấp nở kỳ trùng, chế biến và phát triển hệ sinh vật.
- Từ mốc `Kết Đan` trở lên, quái còn có thể rơi thêm `Yêu đan`.

Điều này khiến việc săn từng loại quái có mục đích rõ ràng hơn thay vì chỉ farm số lượng.

### 8. Linh thạch và kinh tế trong game

`Linh thạch` là tiền tệ chính của trò chơi:

- Có nhiều phẩm chất, tự quy đổi theo giá trị chung.
- Có thể rơi trực tiếp từ quái.
- Dùng để mua vật phẩm trong cửa hàng.
- Có thể thu hồi một phần giá trị bằng cách bán lại vật phẩm trong túi.

Nhờ cơ chế quy đổi, ví trong game vẫn gọn nhưng vẫn giữ được cảm giác phân cấp tài nguyên tu tiên.

### 9. `Linh Thị Cửa Hàng` với tab rõ ràng

Cửa hàng hiện không còn là danh sách dài khó nhìn, mà được chia tab để quản lý dễ hơn:

- `Đan dược`
- `Trùng noãn`
- `Nguyên liệu`
- `Túi`
- `Bí pháp`
- `Khác`

Ngoài ra còn có:

- Ô tìm kiếm theo tên hoặc công dụng.
- Lọc theo phẩm chất.
- Phân trang danh sách vật phẩm.
- Hiển thị ví linh thạch ngay trong popup.

Các vật phẩm đặc biệt như bí pháp, dị hỏa hay vật phẩm mở hệ thống đều được đặt đúng tab để người chơi không bị lẫn.

### 10. Túi trữ vật và quản lý vật phẩm

Túi đồ là một phần quan trọng của vòng chơi:

- Có giới hạn số ô chứa.
- Có thể mở rộng dung tích bằng vật phẩm phù hợp.
- Chia khu rõ ràng giữa vật phẩm, linh thạch và khu linh thú.
- Có thể dùng vật phẩm trực tiếp từ túi.
- Có thể bán vật phẩm không cần thiết để thu về linh thạch.

Các nhóm vật phẩm lớn hiện được trình bày dễ hiểu hơn:

- Đan dược
- Linh thạch
- Trùng noãn
- Linh trùng đã thuần dưỡng
- Túi và vật phẩm mở rộng
- Bí pháp và dị bảo

### 11. Kỳ trùng bảng và thu thập loài

`Kỳ Trùng Bảng` là nơi theo dõi tiến độ sưu tầm:

- Loài đã thu được sẽ sáng thông tin.
- Loài chưa mở sẽ còn ẩn.
- Có thể xem phẩm cấp, phong cách chiến đấu, số lượng trứng đang giữ và số linh trùng đã nuôi.

Đây là phần làm rõ cảm giác “sưu tập linh trùng”, thay vì chỉ xem chúng như một chỉ số ẩn.

### 12. Quái vật có phân tầng sức mạnh

Kẻ địch không chỉ khác nhau về hình:

- Có quái thường và quái tinh anh.
- Có mục tiêu mang khiên, né tránh hoặc kháng chịu tốt hơn.
- Chênh lệch cảnh giới ảnh hưởng trực tiếp đến hiệu quả tấn công.
- Game luôn duy trì lượng quái đủ để người chơi có cảm giác farm liên tục.

Hệ quái này giúp việc lên sức mạnh có phản hồi rõ ràng: cùng một đội hình, khi gặp cảnh giới cao hơn sẽ thấy khác biệt ngay.

### 13. Vật phẩm đặc biệt và bí pháp

Dự án có thêm nhiều vật phẩm đặc thù ngoài đan dược:

- `Đại Canh Kiếm Trận`: bí pháp kiếm đạo chủ đạo.
- `Khu Trùng Thuật`: mở lối chơi dùng đàn kỳ trùng.
- `Kỳ Trùng Bảng`: dị bảo giúp theo dõi huyết mạch và loài đã sưu tầm.
- `Càn Lam Băng Diễm`: thiên địa linh hỏa ảnh hưởng đến hiển thị và màu sắc tâm niệm.

Nhóm vật phẩm này đóng vai trò như những cột mốc mở hệ thống mới, chứ không chỉ tăng chỉ số.

### 14. Bảng quy tắc chỉnh cấu hình ngay trong game

Popup `Thiên Đạo Quy Tắc` cho phép chỉnh nhanh nhiều thông số mà không cần sửa code:

- Mật độ nền và hiệu ứng sao.
- Tốc độ và cảm giác vận hành kiếm trận.
- Nhịp sinh quái.
- Mana, hồi phục, tốc độ.
- Tỉ lệ rơi vật phẩm.
- Nộ và thông số ultimate.
- Một số giới hạn liên quan đến đột phá.

Điểm mạnh của hệ này là rất tiện cho việc cân bằng gameplay hoặc thử nghiệm cảm giác chiến đấu.

### 15. Tối ưu cho cảm giác chơi thực tế

Ngoài gameplay, dự án còn có nhiều chi tiết chăm sóc trải nghiệm:

- Giao diện popup cho shop, túi đồ, hồ sơ và bảng kỳ trùng.
- Hỗ trợ điều khiển chuột, cảm ứng và zoom trên thiết bị di động.
- Nút bấm trên mobile đã được chặn bôi đen text để thao tác mượt hơn.
- Danh sách vật phẩm được chia cột đều, dễ nhìn hơn trên desktop và mobile.
- Hình vật phẩm được tách rõ giữa đan dược, nguyên liệu, trùng noãn, túi và bí pháp để tránh nhầm lẫn.

### 16. Cảnh giới
```text
PHÀM GIỚI
━━━━━━━━━━━━━━━━━━
Luyện Khí
├─ Tầng 1–3  (Nhập môn)
├─ Tầng 4–6  (Ổn định linh lực)
├─ Tầng 7–9  (Tăng trưởng)
├─ Tầng 10–12 (Đỉnh cao)
└─ Tầng 13   (Đại viên mãn / Chuẩn bị Trúc Cơ)

Trúc Cơ
├─ Sơ kỳ
├─ Trung kỳ
├─ Hậu kỳ
└─ Đại viên mãn (→ Kết Đan thất bại có thể phế)

Kết Đan
├─ Sơ kỳ (Kim Đan chưa ổn định)
├─ Trung kỳ (Đan thành hình)
├─ Hậu kỳ (Đan vững chắc)
└─ Đại viên mãn (→ Ngưng Anh)

Nguyên Anh
├─ Sơ kỳ (Anh non)
├─ Trung kỳ (Anh trưởng thành)
├─ Hậu kỳ (Anh ổn định)
└─ Đại viên mãn (→ Hóa Thần)

Hóa Thần
├─ Sơ kỳ (Thần thức mạnh)
├─ Trung kỳ
├─ Hậu kỳ
└─ Đại viên mãn (→ Phi thăng Linh giới)

━━━━━━━━━━━━━━━━━━
LINH GIỚI
━━━━━━━━━━━━━━━━━━
Luyện Hư
├─ Sơ kỳ (tiếp xúc không gian)
├─ Trung kỳ
├─ Hậu kỳ
└─ Đại viên mãn

Hợp Thể
├─ Sơ kỳ (nhục thân + nguyên thần hợp nhất)
├─ Trung kỳ
├─ Hậu kỳ
└─ Đại viên mãn

Đại Thừa
├─ Sơ kỳ (chuẩn bị độ kiếp)
├─ Trung kỳ
├─ Hậu kỳ
└─ Đại viên mãn (→ mở thiên kiếp)

━━━━━━━━━━━━━━━━━━
ĐỘ KIẾP (EVENT SYSTEM)
━━━━━━━━━━━━━━━━━━
├─ Chuẩn bị độ kiếp (tích lũy pháp lực + bảo vật)
├─ Tiểu thiên kiếp
├─ Trung thiên kiếp
├─ Đại thiên kiếp
├─ Thành công → Phi thăng
└─ Thất bại:
   ├─ Trực tiếp tử vong
   └─ → Tán Tiên (nhánh phụ)

━━━━━━━━━━━━━━━━━━
TIÊN GIỚI – NHÁNH PHỤ (TRẠNG THÁI)
━━━━━━━━━━━━━━━━━━
Ngụy Tiên (fake ascension)
Tán Tiên (độ kiếp thất bại, tồn tại bán tiên)
Huyền Tiên (thiên lệch hệ tu riêng)
Địa Tiên (tu theo địa mạch / ngoại đạo)

━━━━━━━━━━━━━━━━━━
TIÊN GIỚI – MAIN PROGRESSION
━━━━━━━━━━━━━━━━━━

Chân Tiên
├─ Sơ kỳ (tiên linh lực hình thành)
├─ Trung kỳ
├─ Hậu kỳ
└─ Đại viên mãn
   └─ Unlock: Pháp tắc sơ cấp + Tiên khiếu

Kim Tiên
├─ Sơ kỳ (ngưng tụ pháp tắc)
├─ Trung kỳ
├─ Hậu kỳ
└─ Đại viên mãn
   └─ Unlock: Linh Vực (Domain Lv1)

Thái Ất (Ngọc Tiên)
├─ Sơ kỳ (hiểu sâu pháp tắc)
├─ Trung kỳ
├─ Hậu kỳ
└─ Đại viên mãn
   └─ Unlock:
      ├─ Linh Vực tiến hóa
      ├─ Điều khiển đa pháp tắc

Đại La
├─ Sơ kỳ
├─ Trung kỳ
├─ Hậu kỳ
├─ Đại viên mãn
└─ Điều kiện đặc biệt:
   ├─ Trảm Nhất Thi
   ├─ Trảm Nhị Thi
   └─ Trảm Tam Thi (full power)
   └─ Unlock:
      ├─ Bất tử gần như tuyệt đối
      ├─ Tồn tại ngoài dòng thời gian

Đạo Tổ (MAX)
├─ Sơ cảnh (Hợp đạo chưa ổn định)
├─ Ổn định đạo (control law hoàn chỉnh)
├─ Trung tầng Đạo Tổ
├─ Đỉnh phong Đạo Tổ
└─ Cơ chế:
   ├─ Hợp nhất với Đại Đạo
   ├─ Không chịu nhân quả thông thường
   └─ Không thể tùy tiện ra tay
```

## ✦ Vòng chơi ngắn gọn

1. Di chuyển tâm trận để tiếp cận quái.
2. Giữ tấn công để kiếm trận hoặc kỳ trùng lao vào mục tiêu.
3. Thu nhặt chiến lợi phẩm rơi ra.
4. Mở túi để dùng hoặc bán vật phẩm.
5. Mua bổ sung tài nguyên trong cửa hàng.
6. Tích đủ tu vi để đột phá.
7. Kích hoạt `Vạn Kiếm Quy Tông` khi cần dọn quái hoặc xử lý mục tiêu mạnh.
8. Thu thập trứng, nguyên liệu và nuôi dần đội hình kỳ trùng mạnh hơn.

## ✦ Điều khiển

### Chuột / Touch

| Thao tác | Chức năng |
| --- | --- |
| Di chuyển chuột hoặc chạm màn hình | Điều khiển tâm trận |
| Giữ nút `Attack` | Tấn công mục tiêu gần hoặc mục tiêu đang bị khóa |
| Bấm `Form` | Đổi trạng thái chiến đấu khả dụng |
| Bấm `Ultimate` | Kích hoạt `Vạn Kiếm Quy Tông` khi đủ nộ |
| Bấm `Shop` | Mở `Linh Thị Cửa Hàng` |
| Bấm `Inventory` | Mở túi trữ vật |
| Bấm `Profile` | Xem hồ sơ nhân vật và thống kê |
| Zoom `+/-` hoặc thao tác chạm | Điều chỉnh khoảng nhìn |

## ✦ Cài đặt và chạy dự án

Yêu cầu đã cài [Node.js](https://nodejs.org/).

```bash
npm install
```

### Lệnh phát triển

| Lệnh | Mô tả |
| --- | --- |
| `npm run build` | Biên dịch SCSS, gộp JS và đồng bộ tài nguyên sang thư mục `public/` |
| `npm run watch` | Theo dõi thay đổi và tự build lại khi đang phát triển |

## ✦ Cấu trúc thư mục

```text
thanh-truc-phong-van-kiem/
├── assets/
│   ├── css/                 # Mã nguồn giao diện SCSS
│   ├── js/                  # Logic game, cấu hình và class gameplay
│   └── images/              # Tài nguyên ảnh gốc
├── public/
│   └── assets/              # Bản build dùng để chạy game
├── index.html               # Điểm vào của ứng dụng
├── gulpfile.js              # Pipeline build
├── package.json             # Scripts và devDependencies
├── readme.md                # Tài liệu tổng hợp dự án
└── .gitignore
```

## ✦ Ghi chú kỹ thuật

- Toàn bộ phần chiến đấu, hiệu ứng và vật phẩm chạy trực tiếp trên `canvas`.
- Mã nguồn được tách thành `config`, `main` và các `class` riêng như kiếm, quái, pill.
- Tài nguyên build được đưa sang thư mục `public/` để phục vụ bản chạy thực tế.
- Một phần cấu hình và tiến trình người chơi có thể lưu bằng `localStorage`.

## ✦ Tác giả

**VHN-DEV**

- GitHub: [https://github.com/VHN-DEV](https://github.com/VHN-DEV)

> "Kiếm trận không nằm ở số lượng, mà ở tâm không loạn."
