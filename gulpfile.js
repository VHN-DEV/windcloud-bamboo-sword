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
    'assets/js/config/app-config.js',
    'assets/js/state/game-context.js',
    'assets/js/core/shared-constants.js',
    'assets/js/core/shared-utils.js',
    'assets/js/core/runtime-globals.js',
    'assets/js/core/gameplay-definitions.js',
    'assets/js/core/player-defaults.js',
    'assets/js/entities/enemy.js',
    'assets/js/entities/sword.js',
    'assets/js/entities/starField.js',
    'assets/js/entities/pill.js',
    'assets/js/entities/camera.js',
    'assets/js/features/ui/ui-core.js',
    'assets/js/features/ui/insect-ui-shared.js',
    'assets/js/features/ui/item-ui-shared.js',
    'assets/js/features/ui/resource-ui-shared.js',
    'assets/js/features/ui/shop-ui.js',
    'assets/js/features/ui/inventory-ui.js',
    'assets/js/features/ui/alchemy-ui.js',
    'assets/js/features/ui/beast-bag-ui.js',
    'assets/js/features/ui/settings-ui.js',
    'assets/js/features/ui/cultivation-panels-ui.js',
    'assets/js/features/progression/game-progress.js',
    'assets/js/features/input/input-state.js',
    'assets/js/features/input/input-player-combat-methods.js',
    'assets/js/features/input/input-progression-insect-methods.js',
    'assets/js/features/input/input-item-artifact-methods.js',
    'assets/js/features/input/input-controller.js',
    'assets/js/core/engine/input-and-sword-overrides.js',
    'assets/js/core/engine/game-loop.js',
    'assets/js/features/systems/thunder-bamboo-system.js',
    'assets/js/vendors/three/three.min.js',
    'assets/js/vendors/three/OrbitControls.js',
    'assets/js/vendors/seedrandom/seedrandom.min.js',
    'assets/js/app/main.js',
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
