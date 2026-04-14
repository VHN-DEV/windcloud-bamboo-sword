const gulp = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const sass = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');

// 1. Biên dịch styles.scss (Đã sửa tên cho khớp với ảnh của bạn)
gulp.task('build-css', function () {
  return gulp.src('assets/css/styles.scss') // Bỏ chữ 's' ở styles
    .pipe(sass().on('error', sass.logError))
    .pipe(cleanCSS())
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('public/assets/css'));
});

// 2. Gộp các file JS thành scripts.min.js
gulp.task('build-js', function () {
  return gulp.src([
    'assets/js/config.js',
    'assets/js/core/shared-constants.js',
    'assets/js/core/shared-utils.js',
    'assets/js/core/runtime-globals.js',
    'assets/js/core/gameplay-definitions.js',
    'assets/js/classes/enemy.js',
    'assets/js/classes/sword.js',
    'assets/js/classes/starField.js',
    'assets/js/classes/pill.js',
    'assets/js/classes/camera.js',
    'assets/js/ui/ui-core.js',
    'assets/js/ui/insect-ui-shared.js',
    'assets/js/ui/item-ui-shared.js',
    'assets/js/ui/resource-ui-shared.js',
    'assets/js/ui/shop-ui.js',
    'assets/js/ui/inventory-ui.js',
    'assets/js/ui/beast-bag-ui.js',
    'assets/js/ui/settings-ui.js',
    'assets/js/ui/cultivation-panels-ui.js',
    'assets/js/game-progress.js',
    'assets/js/input/input-state.js',
    'assets/js/main.js',
    'assets/js/input/input-methods-part1.js',
    'assets/js/input/input-methods-part2.js',
    'assets/js/input/input-methods-part3.js',
    'assets/js/input/input-methods-part4.js',
    'assets/js/input/input-methods-part5.js',
    'assets/js/input/input-methods-part6.js',
    'assets/js/core/input-and-sword-overrides.js',
    'assets/js/core/game-loop.js',
    'assets/js/thunder-bamboo-system.js'
  ])
    .pipe(concat('scripts.js'))
    .pipe(terser())
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('public/assets/js'));
});

// 3. Copy hình ảnh sang public
gulp.task('copy-images', function () {
  return gulp.src('assets/images/**/*', { encoding: false })
    .pipe(gulp.dest('public/assets/images'));
});

// 4. Copy font sang public
gulp.task('copy-fonts', function () {
  return gulp.src([
    'assets/fonts/**/*.{otf,ttf,woff,woff2}',
    '!assets/fonts/._*'
  ], { encoding: false })
    .pipe(gulp.dest('public/assets/fonts'));
});

// Task chạy mặc định
gulp.task('default', gulp.parallel('build-css', 'build-js', 'copy-images', 'copy-fonts'));

// Task theo dõi thay đổi
gulp.task('watch', function () {
  gulp.watch('assets/css/**/*.scss', gulp.series('build-css'));
  gulp.watch('assets/js/**/*.js', gulp.series('build-js'));
  gulp.watch('assets/images/**/*', gulp.series('copy-images'));
  gulp.watch('assets/fonts/**/*.{otf,ttf,woff,woff2}', gulp.series('copy-fonts'));
});
