const       gulp = require('gulp'),
              fs = require('fs'),
         wiredep = require('gulp-wiredep'),
           bsync = require('browser-sync').create(),
          dotenv = require('dotenv'),
            argv = require('yargs').argv, 
           watch = require('gulp-watch'),
            del  = require('del'),
             git = require('gulp-git'),
          gulpif = require('gulp-if'),
        gulpsync = require('gulp-sync')(gulp).sync,
          uglify = require('gulp-uglify');
          cssmin = require('gulp-clean-css');

const  lib = require('./gulp')


const envFileExist = fs.existsSync('./.env');
if(envFileExist) {
  dotenv.config();
}



const config = {
      srcDir   : "src",
      buildDir : "dist",
      tmpDir   : ".tmp",
      contDir  : "contents",
      ghPages   : ["css","fonts","images","js","*.html"],
      env : process.env.ENV,
      ftp:{
        host:    process.env.FTP_HOST,
        user:    process.env.FTP_USER,
        password:process.env.FTP_PASSWORD,
      }
};
 
/**
 * Init tasks stored in ./gulp folder
 */

gulp.task( "sass"          , lib.sass(config, bsync) );
gulp.task( 'contents'      , lib.contents(config, bsync) );
gulp.task( 'ngTemplates'   , lib.ngTemplates(config, bsync) );
gulp.task( "js"            , lib.javascript(config, bsync) );
gulp.task( 'wiredep'       , lib.wiredep(config , bsync) );
gulp.task( 'images'        , lib.images(config , bsync) );
gulp.task( 'fonts'         , ['contents'], lib.fonts(config , bsync) );
gulp.task( 'minify'        , lib.minify(config) );
gulp.task( 'clean:tmp'     , lib.clean(config,"tmpDir") );
gulp.task( 'clean:build'   , lib.clean(config,"buildDir") );
gulp.task( 'clean:gh-pages', lib.clean(config,"ghPages") );
gulp.task( 'ftp:clean'     , lib.ftp(config).clean );
gulp.task( 'ftp:send'      , lib.ftp(config).send  );
gulp.task( 'ftp:chmod'     , lib.ftp(config).chmod );



/**
 * Prepare for dist
 */

gulp.task('prepare',()=>{
  return gulp.src([
          `${config.tmpDir}/**/*.{svg,jpg,png,gif}`,
          `${config.tmpDir}/**/*.{eot,svg,ttf,woff,woff2}`])
         .pipe(gulp.dest(config.buildDir))
});

gulp.task('uglify:js',()=>{
  return gulp.src([`${config.buildDir}/**/*.js`])
         .pipe(uglify())
         .pipe(gulp.dest(config.buildDir))
});

gulp.task('uglify:css',()=>{
  return gulp.src([`${config.buildDir}/**/*.css`])
         .pipe(cssmin())
         .pipe(gulp.dest(config.buildDir))
});

gulp.task('uglify',['uglify:js','uglify:css']);


gulp.task('ftp',gulpsync(['ftp:clean','ftp:send','ftp:chmod']))


gulp.task('git:branch:gh-pages',(done)=>{
  git.branch('gh-pages',(err)=> {
    if (err) throw err;
    done();
  })
})

gulp.task('git:co:gh-pages',(done)=>{
  git.checkout('gh-pages',{},(err)=>{
    if (err) throw err;
    done();
  })
})

gulp.task('git:fetch', (done)=>{
  git.fetch('', '', {args: '--all'},(err)=> {
    if (err) throw err;
    done();
  })
})


gulp.task('git:commit:gh-pages',()=>{
  return gulp.src(["./css/**/*","./fonts/**/*","./images/**/*","./js/**/*","./*.html"])
         .pipe(git.add())
         .pipe(git.commit("Automatic publication",{
                args:"--allow-empty",
                disableAppendPaths: true
           }).on('error',console.log)
         );
})

// Working tree status
gulp.task('git:status', function(){
  git.status({args: '--porcelain'}, function (err, stdout) {
    if (err) throw err;
    console.log(stdout)
  });
});

gulp.task('git:push:gh-pages',(done)=>{
  git.push('origin', 'gh-pages',{},(err)=>{
    if (err) throw err;
    done();
  })
})


gulp.task('git:co:master',(done)=>{
  git.checkout('master',{},(err)=>{
    if (err) throw err;
    done();
  })
})


gulp.task('dist:copy',()=>{
  return gulp.src(["dist/**/*"]).pipe(gulp.dest("."));
})



/**
 * Dev tasks
 */

gulp.task('bsync', () => {
  bsync.init({ 
                server: { baseDir: [ './', config.tmpDir]},
       injectFileTypes: ["css","map", "png", "jpg", "jpeg", "gif", "webp"],
                online: true,
                  open: false,
             });
});


gulp.task('bsync:built', () => {
  bsync.init({ 
                server: { baseDir: [ config.buildDir]},
       injectFileTypes: ["css","map", "png", "jpg", "jpeg", "gif", "webp"],
                online: true,
                  open: false,
             });
});


gulp.task('reload',()=>{
    return gulp.src([`./${config.tmpDir}/**/*.html`,`./${config.tmpDir}/**/*.js`,`./${config.buildDir}/**/*.svg`])
        .pipe(bsync.stream());
})



/**
 *  Default task
 */

const defaultStack = ['contents','sass','wiredep','ngTemplates','js','images','fonts']
gulp.task('default', defaultStack)

const buildStack = defaultStack.map((e)=>e).concat(['minify','uglify','prepare'])
buildStack.unshift('clean:tmp','clean:build')
gulp.task('build', gulpsync(buildStack) )


const buildServeStack = buildStack.map((e)=>e).concat(['bsync:built'])
gulp.task('build:serve', gulpsync(buildServeStack) )


const buildGhPages = buildStack.map((e)=>e).concat([
    'git:branch:gh-pages','git:co:gh-pages','git:fetch','clean:gh-pages','dist:copy','clean:build','git:commit:gh-pages','git:push:gh-pages','git:co:master'])

gulp.task('build:gh-pages',gulpsync(buildGhPages));


const buildFtp = buildStack.map((e)=>e).concat(['ftp:clean','ftp:send','ftp:chmod'])
gulp.task('build:ftp',gulpsync(buildFtp));


gulp.task('watch',['default'], () => {
  
  gulp.start('bsync');
  gulp.watch([`bower.json`],['wiredep']);
  watch([`./${config.srcDir}/sass/**/*.scss`], function(){ gulp.start(['sass']);});
  watch([`./${config.srcDir}/ng/**/*.js`], function(){ gulp.start(['js']);});
  watch([`./${config.srcDir}/ng/**/*.html`], function(){ gulp.start(['ngTemplates']);});
  watch([`./${config.srcDir}/render/**/*.{html,js}`,
         `./${config.contDir}/**/*.{json,md}`], function(){ gulp.start(['contents']);});

  watch([`./${config.srcDir}/fonts/**/*.{eot,svg,ttf,woff,woff2}`],function(){ gulp.start(['fonts'])});
  watch([ `./${config.srcDir}/images/**/*.{svg, jpg, png, gif}`],function(){ gulp.start(['images'])});
  
});




