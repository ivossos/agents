// Silent frame renderer: node render-frames.js <html> <tStart> <tEnd> <out.mp4>
const {chromium}=require('playwright');const {spawn}=require('child_process');const path=require('path');
const [,,html,t0s,t1s,OUT]=process.argv;const FPS=30,t0=+t0s,t1=+t1s;
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
 await p.goto('file://'+path.resolve(html));await p.waitForTimeout(500);
 const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r',String(FPS),OUT],{stdio:['pipe','inherit','inherit']});
 const n=Math.round((t1-t0)*FPS);
 for(let i=0;i<n;i++){await p.evaluate(t=>setT(t),t0+i/FPS);const buf=await p.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r))}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('rendered',OUT,n,'frames');
})();
