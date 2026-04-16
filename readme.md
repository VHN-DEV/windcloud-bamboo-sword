# 72 Thanh Trúc Phong Vân Kiếm - Đại Canh Kiếm Trận

Demo game tu tiên hành động 2D viết bằng `HTML5 Canvas`, nơi người chơi điều khiển tâm trận để vận hành kiếm trận, săn yêu thú, tích lũy tu vi, đột phá cảnh giới và mở khóa nhiều hệ thống như kỳ trùng, đan dược, vật liệu, túi trữ vật và tuyệt kỹ `Vạn Kiếm Quy Tông`.

## ✦ Link dự án

- Demo trực tuyến: [https://vhn-dev.github.io/thanh-truc-phong-van-kiem/](https://vhn-dev.github.io/thanh-truc-phong-van-kiem/)
- Mã nguồn GitHub: [https://github.com/VHN-DEV/thanh-truc-phong-van-kiem](https://github.com/VHN-DEV/thanh-truc-phong-van-kiem)

---

## ✦ Mục lục

1. [Tổng quan gameplay](#-tổng-quan-gameplay)
2. [Tính năng nổi bật](#-tính-năng-nổi-bật)
3. [Hướng dẫn cài đặt & chạy](#-hướng-dẫn-cài-đặt--chạy)
4. [Cấu trúc dự án đầy đủ](#-cấu-trúc-dự-án-đầy-đủ)
5. [Luồng build và phát triển](#-luồng-build-và-phát-triển)
6. [Hướng dẫn mở rộng tính năng](#-hướng-dẫn-mở-rộng-tính-năng)
7. [Ghi chú kỹ thuật](#-ghi-chú-kỹ-thuật)

---

## ✦ Tổng quan gameplay

Vòng chơi cốt lõi:

1. Di chuyển tâm trận để áp sát mục tiêu.
2. Dùng chế độ đánh hiện tại (kiếm trận/kỳ trùng) để tiêu diệt yêu thú.
3. Thu vật phẩm rơi, quản lý trong túi trữ vật.
4. Mua bán vật phẩm trong `Linh Thị Cửa Hàng`.
5. Tích lũy tu vi, đột phá cảnh giới.
6. Kích hoạt `Vạn Kiếm Quy Tông` ở thời điểm cần burst damage.

---

## ✦ Tính năng nổi bật

### 1) Combat đa hệ
- `Thanh Trúc Kiếm Trận`: lối chơi mặc định, thiên về truy kích và kiểm soát giao tranh.
- `Khu Trùng Thuật`: mở nhánh chiến đấu bằng kỳ trùng với cơ chế riêng.

### 2) Tiến trình tu luyện
- Hệ cảnh giới nhiều tầng (từ Phàm Giới đến các tầng cao hơn).
- Cơ chế đột phá có xác suất, có thể dùng vật phẩm hỗ trợ.

### 3) Hệ thống vật phẩm và kinh tế
- Đan dược, nguyên liệu, trùng noãn, bí pháp, linh thạch.
- Cửa hàng theo tab, có lọc/tìm kiếm, hỗ trợ mua bán trực tiếp.

### 4) Hệ kỳ trùng và sưu tầm
- Trùng noãn, ấp nở, ghi nhận vào kỳ trùng bảng.
- Điều phối linh trùng tham chiến/nuôi dưỡng.

### 5) UI/UX tối ưu chơi thực tế
- Popup shop/inventory/profile rõ ràng.
- Hỗ trợ thao tác chuột, cảm ứng và zoom.

---

## ✦ Hướng dẫn cài đặt & chạy

### Yêu cầu
- [Node.js](https://nodejs.org/) (khuyến nghị LTS)
- npm đi kèm Node.js

### Cài đặt dependencies

```bash
npm install
```

### Lệnh phát triển

| Lệnh | Mô tả |
| --- | --- |
| `npm run build` | Build CSS + JS + copy ảnh/font vào `public/assets` |
| `npm run watch` | Theo dõi thay đổi trong `src/assets` và tự build lại |

### Chạy bản build
Sau khi build, mở `public/index.html` bằng static server (hoặc deploy thư mục `public/`).

---

## ✦ Cấu trúc dự án đầy đủ

```text
thanh-truc-phong-van-kiem/
├─ src/
│  └─ assets/
│     ├─ css/
│     │  ├─ styles.scss
│     │  └─ styles/                 # partial SCSS
│     ├─ js/
│     │  ├─ app/                    # entry/bootstrap
│     │  ├─ config/                 # cấu hình global
│     │  ├─ state/                  # trạng thái/ngữ cảnh runtime
│     │  ├─ core/                   # constants, utils, engine logic
│     │  ├─ entities/               # thực thể gameplay (enemy, sword...)
│     │  ├─ features/
│     │  │  ├─ input/
│     │  │  ├─ progression/
│     │  │  ├─ systems/
│     │  │  └─ ui/
│     │  └─ vendors/                # thư viện third-party
│     ├─ images/
│     └─ fonts/
├─ public/
│  ├─ index.html
│  └─ assets/                       # output sau build
├─ gulpfile.js                      # pipeline build/watch
├─ package.json                     # scripts và dependencies
└─ readme.md
```

> Nguồn phát triển nằm trong `src/assets/*`; tuyệt đối không sửa trực tiếp file trong `public/assets/*`.

---

## ✦ Luồng build và phát triển

`gulpfile.js` hiện định nghĩa các task chính:

1. `build-css`: compile `src/assets/css/styles.scss` -> `public/assets/css/styles.min.css`.
2. `build-js`: concat + minify JS theo **thứ tự cố định** -> `public/assets/js/scripts.min.js`.
3. `copy-images`: copy `src/assets/images/**/*` -> `public/assets/images`.
4. `copy-fonts`: copy `src/assets/fonts/**/*` -> `public/assets/fonts`.

Thứ tự file JS trong `build-js` cần được giữ đúng để tránh lỗi runtime do dependency toàn cục.

---

## ✦ Hướng dẫn mở rộng tính năng

### Thêm tính năng gameplay mới
1. Tạo module trong `src/assets/js/features/<ten-feature>/`.
2. Nếu cần state dùng chung, thêm vào `state/` hoặc `core/`.
3. Cập nhật thứ tự load ở `gulpfile.js` trong task `build-js`.
4. Chạy `npm run build` để xác nhận không lỗi.

### Thêm UI panel mới
1. Tạo file trong `src/assets/js/features/ui/`.
2. Đăng ký hook render/event từ `ui-core.js` hoặc module tương ứng.
3. Nếu có style riêng, bổ sung SCSS trong `src/assets/css/styles/` và import vào `styles.scss`.

### Thêm asset mới (ảnh/font)
- Đặt vào `src/assets/images` hoặc `src/assets/fonts`.
- Build lại để đồng bộ sang `public/assets`.

---

## ✦ Điều khiển cơ bản

| Thao tác | Chức năng |
| --- | --- |
| Di chuyển chuột/chạm màn hình | Điều khiển tâm trận |
| Giữ `Attack` | Tấn công mục tiêu |
| Bấm `Form` | Đổi trạng thái chiến đấu |
| Bấm `Ultimate` | Kích hoạt `Vạn Kiếm Quy Tông` |
| Bấm `Shop` | Mở cửa hàng |
| Bấm `Inventory` | Mở túi đồ |
| Zoom +/- | Điều chỉnh khoảng nhìn |

---

## ✦ Ghi chú kỹ thuật

- Game chạy trên `canvas` với kiến trúc JS thuần + build pipeline Gulp.
- Mã nguồn được tổ chức theo hướng feature-oriented để dễ mở rộng và onboarding.
- Một phần tiến trình/cấu hình có thể lưu trong `localStorage`.
- Nên giữ nguyên quy ước đặt tên file và thứ tự load JS để tránh regression.

---

## ✦ Tác giả

**VHN-DEV**

- GitHub: [https://github.com/VHN-DEV](https://github.com/VHN-DEV)

> "Kiếm trận không nằm ở số lượng, mà ở tâm không loạn."
